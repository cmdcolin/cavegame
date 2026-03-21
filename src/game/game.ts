import { Engine, W, H } from './engine';
import { SCENES, type Scene, type Hotspot } from './scenes';

type GameState = {
  sceneIdx: number;
  message: string | null;
  hoveredHotspot: Hotspot | null;
};

export async function startGame(canvas: HTMLCanvasElement, overlayEl: HTMLElement) {
  await document.fonts.ready;

  // Hidden 2D canvas for pixel art drawing
  const draw = document.createElement('canvas');
  draw.width = W;
  draw.height = H;
  const ctx = draw.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  const engine = await Engine.init(canvas);

  const state: GameState = {
    sceneIdx: 0,
    message: null,
    hoveredHotspot: null,
  };


  function currentScene(): Scene {
    return SCENES[state.sceneIdx];
  }

  function drawScene(t: number) {
    ctx.clearRect(0, 0, W, H);
    currentScene().draw(ctx, t);
    // Highlight hovered hotspot
    if (state.hoveredHotspot) {
      const h = state.hoveredHotspot;
      ctx.strokeStyle = '#f0e8e066';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 2]);
      ctx.strokeRect(h.x + 0.5, h.y + 0.5, h.w - 1, h.h - 1);
      ctx.setLineDash([]);
    }
  }

  function toGameCoords(e: MouseEvent): [number, number] {
    const rect = canvas.getBoundingClientRect();
    return [
      (e.clientX - rect.left) / rect.width * W,
      (e.clientY - rect.top) / rect.height * H,
    ];
  }

  function hotspotAt(gx: number, gy: number): Hotspot | null {
    for (const hs of currentScene().hotspots) {
      if (gx >= hs.x && gx < hs.x + hs.w && gy >= hs.y && gy < hs.y + hs.h) {
        return hs;
      }
    }
    return null;
  }

  function showMessage(msg: string) {
    state.message = msg;
    overlayEl.textContent = msg;
    overlayEl.classList.remove('label-mode');
    overlayEl.classList.add('visible');
    setTimeout(() => {
      state.message = null;
      overlayEl.classList.remove('visible');
    }, 4500);
  }

  function navigateTo(sceneId: string, transType: number, now: number) {
    const nextIdx = SCENES.findIndex(s => s.id === sceneId);
    if (nextIdx === -1) return;

    canvas.style.pointerEvents = 'none';

    // Draw current scene cleanly (no hover highlight) then snapshot
    state.hoveredHotspot = null;
    ctx.clearRect(0, 0, W, H);
    currentScene().draw(ctx, now * 0.001);
    engine.snapshotFrom(draw);
    state.sceneIdx = nextIdx;
    state.message = null;
    overlayEl.classList.remove('visible');

    // Draw new scene at t=0 (static) and upload
    ctx.clearRect(0, 0, W, H);
    SCENES[nextIdx].draw(ctx, 0);
    engine.beginTransition(draw, transType, now);

    engine.onTransitionEnd = () => {
      canvas.style.pointerEvents = '';
    };
  }

  canvas.addEventListener('mousemove', (e) => {
    if (engine.transitioning) return;
    const [gx, gy] = toGameCoords(e);
    const hs = hotspotAt(gx, gy);
    state.hoveredHotspot = hs;
    canvas.style.cursor = hs ? 'pointer' : 'default';
    if (hs && !state.message) {
      overlayEl.textContent = hs.label;
      overlayEl.classList.add('visible', 'label-mode');
    } else if (!hs && !state.message) {
      overlayEl.classList.remove('visible', 'label-mode');
    }
  });

  canvas.addEventListener('mouseleave', () => {
    state.hoveredHotspot = null;
    canvas.style.cursor = 'default';
    if (!state.message) overlayEl.classList.remove('visible', 'label-mode');
  });

  canvas.addEventListener('click', (e) => {
    if (engine.transitioning) return;
    const [gx, gy] = toGameCoords(e);
    const hs = hotspotAt(gx, gy);
    if (!hs) return;

    if (hs.message) {
      overlayEl.classList.remove('label-mode');
      showMessage(hs.message);
    } else if (hs.goto) {
      const transType = hs.transitionType ?? Math.floor(Math.random() * 4);
      navigateTo(hs.goto, transType, performance.now());
    }
  });

  // Main loop — redraw canvas every frame for animations (torch, crystals, etc.)
  function loop(now: number) {
    if (!engine.transitioning) {
      drawScene(now * 0.001);
      engine.setScene(draw);
    }
    engine.render(now);
    requestAnimationFrame(loop);
  }

  // Draw first scene and kick off
  drawScene(0);
  engine.setScene(draw);
  requestAnimationFrame(loop);
}

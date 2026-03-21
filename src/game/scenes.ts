export type Hotspot = {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  goto?: string;
  message?: string;
  transitionType?: number; // 0-3, defaults to random
};

export type Scene = {
  id: string;
  draw: (ctx: CanvasRenderingContext2D, t: number) => void;
  hotspots: Hotspot[];
};

// ─── Palette ────────────────────────────────────────────────────────────────

const C = {
  void:       '#050309',
  nightSky:   '#0e0920',
  dusk:       '#1a1035',
  stars:      '#e8dfc8',
  cliff:      '#28202e',
  rock:       '#3c3248',
  rockMid:    '#524858',
  rockLight:  '#786c88',
  cavemouth:  '#08040e',
  earth:      '#2a1c10',
  darkEarth:  '#180e08',
  soil:       '#382418',
  torchA:     '#e05808',
  torchB:     '#f0a010',
  torchC:     '#ffe060',
  crystalA:   '#3818a0',
  crystalB:   '#6030d8',
  crystalC:   '#9860ff',
  crystalD:   '#c0a0ff',
  crystalGlow:'#e8d0ff',
  water:      '#080e20',
  waterMid:   '#101a30',
  waterShine: '#1c2e50',
  wood:       '#6a4020',
  woodDark:   '#482c10',
  stone:      '#403040',
  stoneMid:   '#604e60',
  stoneLight: '#887888',
  moss:       '#1e400e',
  mossLight:  '#2e6018',
  rune:       '#c8a020',
  runeGlow:   '#f0c840',
  creature:   '#502828',
  creatureD:  '#301818',
  white:      '#f0e8e0',
  dim:        '#887880',
  mushA:      '#a03020',
  mushB:      '#e06040',
  mushGlow:   '#ff9870',
  gold:       '#d0a820',
};

// ─── Drawing helpers ─────────────────────────────────────────────────────────

function r(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string) {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

// Checkerboard dither fill (2x2 pattern)
function dither(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string) {
  ctx.fillStyle = c;
  for (let py = y; py < y + h; py += 2) {
    for (let px = x; px < x + w; px += 2) {
      ctx.fillRect(Math.round(px), Math.round(py), 1, 1);
    }
  }
}

// Seeded random (stable per-scene)
function seededRand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

// Draw a diamond-shaped crystal
function crystal(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
  colors: string[]
) {
  const half = Math.floor(h / 2);
  for (let i = 0; i < h; i++) {
    const progress = i <= half ? i / half : 1 - (i - half) / half;
    const pw = Math.max(1, Math.round(w * progress));
    const px = cx - Math.floor(pw / 2);
    const col = colors[Math.floor((i / h) * colors.length)];
    r(ctx, px, cy + i, pw, 1, col);
  }
}

// Stalactite hanging from y downward
function stalactite(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string) {
  for (let i = 0; i < h; i++) {
    const pw = Math.max(1, Math.round(w * (1 - i / h)));
    r(ctx, x + Math.floor((w - pw) / 2), y + i, pw, 1, c);
  }
}

// Stalagmite rising from y upward
function stalagmite(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string) {
  for (let i = 0; i < h; i++) {
    const pw = Math.max(1, Math.round(w * (i / h)));
    r(ctx, x + Math.floor((w - pw) / 2), y - i, pw, 1, c);
  }
}

// Draw pixel text using canvas font
function ptext(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, c = C.white, px = 6) {
  ctx.fillStyle = c;
  ctx.font = `${px}px "Press Start 2P", monospace`;
  ctx.imageSmoothingEnabled = false;
  ctx.fillText(s, x, y);
}

// Flickering torch (color changes with time)
function torch(ctx: CanvasRenderingContext2D, x: number, y: number, t: number) {
  const flicker = Math.sin(t * 7.3) * 0.5 + Math.sin(t * 13.1) * 0.3;
  // Handle / sconce
  r(ctx, x, y + 8, 2, 10, C.rockMid);
  r(ctx, x - 2, y + 6, 6, 4, C.rockMid);
  // Flame base
  r(ctx, x - 1, y + 4, 4, 5, flicker > 0.2 ? C.torchA : C.torchB);
  // Flame tip
  r(ctx, x, y + 1, 2, 4, flicker > 0 ? C.torchB : C.torchC);
  r(ctx, x, y, 2, 2, C.torchC);
  // Glow halo (dithered)
  dither(ctx, x - 6, y - 4, 14, 16, flicker > 0 ? C.torchA + '44' : C.torchB + '33');
}

// ─── Szaznak ─────────────────────────────────────────────────────────────────
// Round demonic cave-dweller. Single eye, horns, toothy grin, big attitude.

type SzaznakPose = 'wave' | 'stand' | 'excited' | 'fish' | 'throne';

function drawSzaznak(
  ctx: CanvasRenderingContext2D,
  cx: number,  // center x
  by: number,  // bottom y (feet)
  t: number,
  pose: SzaznakPose,
) {
  const S = {
    bodyD:  '#3a0c0c',
    bodyM:  '#5e1a1a',
    bodyL:  '#7c2828',
    bodyHL: '#963434',
    eyeW:   '#f2e8c0',
    eyeI:   '#ff9200',
    eyeP:   '#080304',
    tooth:  '#e8dfaa',
    tongue: '#cc2838',
    hornD:  '#260606',
    hornM:  '#381010',
  };

  const bob = Math.round(Math.sin(t * 2.8) * 1.5);
  const fy = by - 30 + bob; // body top-y (30px tall including feet)

  // Ground shadow
  r(ctx, cx - 10, by + 1, 20, 2, '#00000030');

  // === FEET ===
  r(ctx, cx - 11, by - 6, 9, 6, S.bodyD);
  r(ctx, cx + 2,  by - 6, 9, 6, S.bodyD);
  r(ctx, cx - 10, by - 5, 7, 6, S.bodyM);
  r(ctx, cx + 3,  by - 5, 7, 6, S.bodyM);

  // === BODY (round) — widest in the middle ===
  r(ctx, cx - 7,  fy + 2, 14, 2,  S.bodyD);  // top cap
  r(ctx, cx - 10, fy + 4, 20, 4,  S.bodyM);
  r(ctx, cx - 12, fy + 8, 24, 8,  S.bodyL);  // widest
  r(ctx, cx - 10, fy + 16, 20, 4, S.bodyM);
  r(ctx, cx - 8,  fy + 20, 16, 3, S.bodyD);  // bottom taper (above feet)
  // Left shade + highlight
  r(ctx, cx - 11, fy + 8,  3, 8, S.bodyD);
  r(ctx, cx - 5,  fy + 3,  8, 3, S.bodyHL);

  // === HORNS ===
  // Left horn (smaller)
  r(ctx, cx - 9, fy - 1, 4, 4, S.hornM);
  r(ctx, cx - 8, fy - 4, 3, 4, S.hornD);
  r(ctx, cx - 7, fy - 6, 2, 3, S.hornD);
  // Right horn (bigger, crookeder)
  r(ctx, cx + 5,  fy - 1, 5, 4, S.hornM);
  r(ctx, cx + 6,  fy - 4, 4, 4, S.hornD);
  r(ctx, cx + 7,  fy - 8, 2, 5, S.hornD);
  r(ctx, cx + 8,  fy - 10, 2, 3, S.hornD);

  // === SINGLE LARGE EYE ===
  // White
  r(ctx, cx - 6, fy + 5,  12, 8,  S.eyeW);
  r(ctx, cx - 7, fy + 6,  14, 6,  S.eyeW);
  r(ctx, cx - 5, fy + 4,  10, 10, S.eyeW);
  // Iris
  r(ctx, cx - 3, fy + 6, 6, 6, S.eyeI);
  r(ctx, cx - 4, fy + 7, 8, 4, S.eyeI);
  // Slit pupil (demonic)
  r(ctx, cx - 1, fy + 6, 2, 6, S.eyeP);
  // Shine
  r(ctx, cx - 2, fy + 4, 3, 2, '#ffffffee');
  r(ctx, cx + 1, fy + 5, 1, 1, '#ffffff99');
  // Heavy brow (menacing angle)
  r(ctx, cx - 8, fy + 3, 16, 3, S.bodyD);
  r(ctx, cx - 8, fy + 3, 7,  2, S.bodyM);  // left brow lower = scowl

  // === MOUTH ===
  const my = fy + 15;
  r(ctx, cx - 8, my, 16, 6, '#160606');
  // Upper teeth (jagged)
  r(ctx, cx - 6, my,    3, 4, S.tooth);
  r(ctx, cx - 2, my,    3, 4, S.tooth);
  r(ctx, cx + 2, my,    3, 4, S.tooth);
  // Lower teeth (smaller)
  r(ctx, cx - 5, my + 3, 2, 2, S.tooth);
  r(ctx, cx + 1, my + 3, 2, 2, S.tooth);
  r(ctx, cx + 4, my + 3, 2, 2, S.tooth);
  // Tongue
  r(ctx, cx - 2, my + 2, 4, 3, S.tongue);

  // === ARMS / POSE ===
  if (pose === 'wave') {
    const wf = Math.sin(t * 5) * 4;
    // Left arm down
    r(ctx, cx - 19, fy + 11, 9, 4, S.bodyM);
    r(ctx, cx - 18, fy + 13, 6, 3, S.bodyD);
    // Right arm waving up
    r(ctx, cx + 11, fy + 9, 8, 4, S.bodyM);
    r(ctx, cx + 17, fy + 4 + wf, 6, 4, S.bodyM);
    r(ctx, cx + 21, fy + 0 + wf, 4, 6, S.bodyD);
  } else if (pose === 'stand') {
    r(ctx, cx - 19, fy + 12, 9, 4, S.bodyM);
    r(ctx, cx - 18, fy + 14, 6, 3, S.bodyD);
    r(ctx, cx + 11, fy + 12, 9, 4, S.bodyM);
    r(ctx, cx + 11, fy + 14, 6, 3, S.bodyD);
  } else if (pose === 'excited') {
    const ef = Math.sin(t * 9) * 3;
    r(ctx, cx - 21, fy + 7 + ef,  10, 4, S.bodyM);
    r(ctx, cx - 23, fy + 3 + ef,  6,  6, S.bodyD);
    r(ctx, cx + 11, fy + 7 - ef,  10, 4, S.bodyM);
    r(ctx, cx + 17, fy + 3 - ef,  6,  6, S.bodyD);
  } else if (pose === 'fish') {
    // Left arm down
    r(ctx, cx - 19, fy + 12, 9, 4, S.bodyM);
    r(ctx, cx - 18, fy + 14, 6, 3, S.bodyD);
    // Right arm holding fishing rod
    r(ctx, cx + 11, fy + 10, 8, 4, S.bodyM);
    r(ctx, cx + 17, fy + 6,  6, 4, S.bodyM);
    // Rod
    r(ctx, cx + 21, fy - 4, 2, 26, S.hornD);
    // Fishing line (thin, diagonal)
    for (let i = 0; i < 20; i++) {
      r(ctx, cx + 22 + Math.round(i * 0.4), fy + 22 + i, 1, 1, S.eyeW + '99');
    }
    // Hook / bait
    r(ctx, cx + 30, fy + 42, 2, 2, S.eyeI);
  } else if (pose === 'throne') {
    // Arms spread wide on armrests — seated
    r(ctx, cx - 22, fy + 14, 12, 4, S.bodyM);
    r(ctx, cx - 22, fy + 16, 10, 3, S.bodyD);
    r(ctx, cx + 10, fy + 14, 12, 4, S.bodyM);
    r(ctx, cx + 12, fy + 16, 10, 3, S.bodyD);
  }
}

// ─── Scene 1: Cave Entrance (outside) ────────────────────────────────────────

function drawEntrance(ctx: CanvasRenderingContext2D, t: number) {
  const rng = seededRand(42);

  // Sky gradient bands
  r(ctx, 0, 0,   320, 40,  C.nightSky);
  r(ctx, 0, 40,  320, 30,  C.dusk);
  r(ctx, 0, 70,  320, 30,  '#120d28');

  // Stars
  for (let i = 0; i < 35; i++) {
    const sx = Math.floor(rng() * 320);
    const sy = Math.floor(rng() * 60);
    const twinkle = Math.sin(t * (1 + rng() * 3) + rng() * 6);
    if (twinkle > -0.3) {
      r(ctx, sx, sy, 1, 1, C.stars);
    }
  }

  // Distant mountains / ridgeline
  r(ctx, 0,   90, 50, 90, C.cliff);
  r(ctx, 0,   80, 30, 10, C.cliff);
  r(ctx, 270, 85, 50, 95, C.cliff);
  r(ctx, 290, 75, 30, 10, C.cliff);

  // Left cliff wall
  r(ctx, 0,   0, 70, 180, C.cliff);
  r(ctx, 10,  0, 60, 180, C.rock);
  r(ctx, 20,  0, 50, 180, C.rockMid);
  // Rock texture blobs
  r(ctx, 30, 20, 16, 8,   C.cliff);
  r(ctx, 14, 50, 10, 6,   C.cliff);
  r(ctx, 22, 90, 20, 10,  C.cliff);
  r(ctx, 36, 130, 14, 8,  C.cliff);

  // Right cliff wall
  r(ctx, 250, 0, 70, 180, C.cliff);
  r(ctx, 250, 0, 60, 180, C.rock);
  r(ctx, 250, 0, 50, 180, C.rockMid);
  // Rock texture
  r(ctx, 262, 25, 14, 8,  C.cliff);
  r(ctx, 274, 65, 10, 6,  C.cliff);
  r(ctx, 258, 110, 20, 10, C.cliff);
  r(ctx, 270, 150, 12, 8, C.cliff);

  // Cave opening (arch shape — series of rects)
  r(ctx, 70,  40, 180, 140, C.cavemouth);
  r(ctx, 80,  30, 160, 10,  C.cavemouth);
  r(ctx, 90,  22, 140, 10,  C.cavemouth);
  r(ctx, 104, 16, 112, 8,   C.cavemouth);
  r(ctx, 116, 12, 88,  6,   C.cavemouth);

  // Stalactites at cave top
  stalactite(ctx, 80,  40, 12, 18, C.cliff);
  stalactite(ctx, 100, 30, 8,  14, C.rock);
  stalactite(ctx, 118, 22, 10, 20, C.cliff);
  stalactite(ctx, 136, 16, 7,  16, C.rock);
  stalactite(ctx, 154, 12, 9,  22, C.cliff);
  stalactite(ctx, 172, 15, 7,  18, C.rock);
  stalactite(ctx, 188, 18, 11, 20, C.cliff);
  stalactite(ctx, 206, 24, 8,  16, C.rock);
  stalactite(ctx, 222, 30, 10, 14, C.cliff);
  stalactite(ctx, 238, 40, 12, 18, C.rock);

  // Ground / soil
  r(ctx, 0,   148, 320, 32, C.darkEarth);
  r(ctx, 0,   155, 320, 25, C.earth);
  r(ctx, 0,   162, 320, 18, C.soil);

  // Moss patches on ground
  dither(ctx, 40,  155, 30, 6, C.moss);
  dither(ctx, 240, 158, 28, 5, C.moss);

  // Path into cave (slightly lighter ground strip)
  r(ctx, 110, 155, 100, 25, '#2e1e12');

  // Torch on left wall
  torch(ctx, 46, 80, t);
  // Torch on right wall
  torch(ctx, 272, 80, t + 1.4);

  // Sign post
  r(ctx, 180, 145, 4, 20, C.woodDark);  // post
  r(ctx, 170, 132, 44, 18, C.wood);     // sign board
  r(ctx, 172, 134, 40, 14, C.woodDark); // sign bg
  ptext(ctx, 'NO', 176, 143, C.torchB, 6);
  ptext(ctx, 'CAVES', 174, 144, C.torchB, 5);

  // Depth darkening at cave mouth
  dither(ctx, 70, 40, 30, 140, C.cavemouth);
  dither(ctx, 220, 40, 30, 140, C.cavemouth);

  // Szaznak — waving at the cave entrance
  drawSzaznak(ctx, 95, 175, t, 'wave');
}

// ─── Scene 2: Main Chamber ────────────────────────────────────────────────────

function drawMainChamber(ctx: CanvasRenderingContext2D, t: number) {
  // Cave ceiling / walls
  r(ctx, 0, 0, 320, 180, C.void);
  r(ctx, 0, 0, 320, 50,  C.cliff);
  r(ctx, 0, 0, 40,  180, C.cliff);
  r(ctx, 280, 0, 40, 180, C.cliff);

  // Ceiling variation
  r(ctx, 40, 0, 240, 35, C.rock);
  r(ctx, 60, 0, 200, 25, C.rockMid);

  // Stalactites from ceiling
  stalactite(ctx, 50,  35, 10, 22, C.cliff);
  stalactite(ctx, 72,  25, 7,  18, C.rock);
  stalactite(ctx, 92,  25, 12, 28, C.cliff);
  stalactite(ctx, 116, 25, 6,  15, C.rock);
  stalactite(ctx, 140, 25, 9,  20, C.cliff);
  stalactite(ctx, 164, 25, 7,  16, C.rock);
  stalactite(ctx, 182, 25, 11, 24, C.cliff);
  stalactite(ctx, 204, 25, 7,  14, C.rock);
  stalactite(ctx, 224, 25, 10, 26, C.cliff);
  stalactite(ctx, 248, 35, 8,  18, C.rock);

  // Left wall + left tunnel entrance
  r(ctx, 0, 50, 50, 130, C.rock);
  r(ctx, 0, 50, 40, 130, C.rockMid);
  // Left tunnel hole
  r(ctx, 0, 78, 46, 68,  C.cavemouth);
  r(ctx, 6, 70, 40, 6,   C.cavemouth);
  r(ctx, 12, 64, 28, 8,  C.cavemouth);
  // Crystal glow bleeding out from left tunnel
  dither(ctx, 0, 80, 56, 60, C.crystalB + '66');
  r(ctx, 0, 90, 12, 40, C.crystalA + '44');

  // Right wall + right tunnel entrance
  r(ctx, 270, 50, 50, 130, C.rock);
  r(ctx, 280, 50, 40, 130, C.rockMid);
  // Right tunnel hole
  r(ctx, 274, 78, 46, 68, C.cavemouth);
  r(ctx, 274, 70, 40, 6,  C.cavemouth);
  r(ctx, 280, 64, 28, 8,  C.cavemouth);
  // Damp water drip glow from right tunnel
  dither(ctx, 264, 80, 56, 60, C.waterMid + '44');

  // Back wall
  r(ctx, 40, 50, 240, 130, '#0c0a14');
  r(ctx, 50, 55, 220, 120, '#0e0c18');

  // Floor
  r(ctx, 0, 150, 320, 30, C.darkEarth);
  r(ctx, 40, 155, 240, 25, C.earth);
  r(ctx, 60, 160, 200, 20, '#30201a');

  // Stalagmites from floor
  stalagmite(ctx, 55,  150, 8,  14, C.rock);
  stalagmite(ctx, 75,  152, 5,  10, C.rockMid);
  stalagmite(ctx, 240, 150, 7,  12, C.rock);
  stalagmite(ctx, 260, 152, 5,  9,  C.rockMid);

  // Glowing mushrooms on back wall
  const mushFlicker = Math.sin(t * 2.1) * 0.4 + 0.6;
  // Mushroom cluster 1
  r(ctx, 128, 118, 6, 10, C.mushA);
  r(ctx, 124, 114, 14, 6, C.mushB);
  r(ctx, 122, 110, 18, 6, mushFlicker > 0.5 ? C.mushGlow : C.mushB);
  // Mushroom cluster 2
  r(ctx, 160, 122, 5, 8, C.mushA);
  r(ctx, 157, 119, 11, 5, C.mushB);
  r(ctx, 155, 115, 15, 6, mushFlicker > 0.3 ? C.mushGlow : C.mushB);

  // Torches
  torch(ctx, 54, 95, t);
  torch(ctx, 264, 95, t + 0.8);

  // Third passage — deeper dark in the back center wall
  r(ctx, 128, 52, 64, 60, C.cavemouth);
  r(ctx, 136, 44, 48, 12, C.cavemouth);
  r(ctx, 144, 38, 32,  8, C.cavemouth);
  // Faint ominous glow from deep passage
  dither(ctx, 130, 54, 60, 56, C.stone + '33');

  // Direction labels (diegetic, carved into stone)
  ptext(ctx, '< CRYSTALS', 4, 75, C.crystalC, 5);
  ptext(ctx, 'LAKE >', 271, 75, C.waterShine, 5);
  ptext(ctx, '? DEEPER', 130, 50, C.dim, 5);

  // Szaznak — standing center-left, very welcoming (or not)
  drawSzaznak(ctx, 160, 148, t, 'stand');
}

// ─── Scene 3: Crystal Room ────────────────────────────────────────────────────

function drawCrystalRoom(ctx: CanvasRenderingContext2D, t: number) {
  r(ctx, 0, 0, 320, 180, C.void);
  // Cave walls
  r(ctx, 0, 0, 320, 40,   C.cliff);
  r(ctx, 0, 0, 60,  180,  C.cliff);
  r(ctx, 260, 0, 60, 180, C.cliff);
  r(ctx, 40, 0, 240, 30,  C.rock);

  // Ambient crystal glow pulsing on walls
  const glow = Math.sin(t * 1.4) * 0.5 + 0.5;
  dither(ctx, 0, 0, 320, 180, glow > 0.6 ? C.crystalA + '33' : C.crystalB + '22');

  // Floor
  r(ctx, 0, 148, 320, 32, C.darkEarth);
  r(ctx, 40, 152, 240, 28, '#180e28');
  // Crystal dust on floor
  dither(ctx, 50, 155, 220, 20, C.crystalA);

  // Back wall features
  r(ctx, 60, 40, 200, 110, '#080414');
  // Cracks
  r(ctx, 90,  42, 2, 60, C.cliff);
  r(ctx, 180, 44, 2, 50, C.cliff);

  // Big crystal cluster center-right
  crystal(ctx, 220, 85, 18, 60, [C.crystalA, C.crystalB, C.crystalC, C.crystalD, C.crystalGlow]);
  crystal(ctx, 240, 100, 12, 46, [C.crystalB, C.crystalC, C.crystalD]);
  crystal(ctx, 200, 105, 10, 38, [C.crystalA, C.crystalB, C.crystalC]);
  crystal(ctx, 232, 120, 8, 28, [C.crystalB, C.crystalC]);

  // Big crystal cluster left
  crystal(ctx, 95, 90, 16, 56, [C.crystalA, C.crystalB, C.crystalC, C.crystalD]);
  crystal(ctx, 78, 108, 10, 40, [C.crystalB, C.crystalC]);
  crystal(ctx, 112, 105, 8, 34, [C.crystalA, C.crystalB]);

  // Small crystals scattered
  crystal(ctx, 160, 118, 6, 24, [C.crystalB, C.crystalC, C.crystalD]);
  crystal(ctx, 140, 128, 4, 18, [C.crystalC, C.crystalD]);
  crystal(ctx, 185, 125, 5, 20, [C.crystalB, C.crystalC]);

  // Floor crystals
  crystal(ctx, 70,  150, 8,  14, [C.crystalA, C.crystalB]);
  crystal(ctx, 250, 148, 7,  16, [C.crystalB, C.crystalC]);
  crystal(ctx, 170, 150, 5,  12, [C.crystalC, C.crystalD]);

  // Stalactites with crystal tints
  stalactite(ctx, 55,  30, 10, 24, C.rock);
  stalactite(ctx, 78,  28, 8,  20, C.crystalA);
  stalactite(ctx, 100, 28, 12, 30, C.rock);
  stalactite(ctx, 130, 28, 6,  16, C.crystalB);
  stalactite(ctx, 158, 28, 10, 26, C.rock);
  stalactite(ctx, 186, 28, 7,  18, C.crystalA);
  stalactite(ctx, 214, 28, 11, 28, C.rock);
  stalactite(ctx, 242, 28, 8,  20, C.crystalB);
  stalactite(ctx, 265, 30, 9,  22, C.rock);

  // Glow from crystal clusters (animated)
  const pulseA = Math.sin(t * 1.4 + 0.0) * 0.4 + 0.6;
  const pulseB = Math.sin(t * 1.4 + 2.1) * 0.4 + 0.6;
  const pulseC = Math.sin(t * 1.4 + 4.2) * 0.4 + 0.6;
  if (pulseA > 0.7) dither(ctx, 68, 60, 70, 80, C.crystalC + '44');
  if (pulseB > 0.7) dither(ctx, 190, 60, 70, 80, C.crystalB + '44');
  if (pulseC > 0.6) dither(ctx, 130, 100, 60, 50, C.crystalGlow + '33');

  // Drips from ceiling
  for (let i = 0; i < 5; i++) {
    const dx = 80 + i * 40;
    const dy = 40 + Math.floor(Math.sin(t * 0.8 + i) * 4);
    r(ctx, dx, dy, 1, 6, C.crystalC + 'aa');
  }

  // Szaznak — vibrating with crystal energy
  drawSzaznak(ctx, 155, 148, t, 'excited');
}

// ─── Scene 4: Underground Lake ───────────────────────────────────────────────

function drawUndergroundLake(ctx: CanvasRenderingContext2D, t: number) {
  r(ctx, 0, 0, 320, 180, C.void);

  // Ceiling
  r(ctx, 0, 0, 320, 45, C.cliff);
  r(ctx, 0, 0, 320, 35, C.rock);
  r(ctx, 20, 0, 280, 25, C.rockMid);

  // Left and right walls
  r(ctx, 0, 0, 30, 180, C.cliff);
  r(ctx, 290, 0, 30, 180, C.cliff);

  // Stalactites from ceiling — lots of them over water
  stalactite(ctx, 28,  35, 8, 20, C.cliff);
  stalactite(ctx, 48,  25, 10, 26, C.rock);
  stalactite(ctx, 68,  25, 6, 16, C.cliff);
  stalactite(ctx, 88,  25, 12, 30, C.rock);
  stalactite(ctx, 114, 25, 7, 18, C.cliff);
  stalactite(ctx, 138, 25, 11, 28, C.rock);
  stalactite(ctx, 162, 25, 6, 14, C.cliff);
  stalactite(ctx, 182, 25, 10, 24, C.rock);
  stalactite(ctx, 208, 25, 8, 20, C.cliff);
  stalactite(ctx, 228, 25, 12, 28, C.rock);
  stalactite(ctx, 254, 25, 6, 16, C.cliff);
  stalactite(ctx, 274, 35, 8, 18, C.rock);

  // Rocky banks left and right
  r(ctx, 0,  100, 80,  80, C.rock);
  r(ctx, 10, 110, 70,  70, C.rockMid);
  r(ctx, 0,  120, 50,  60, C.cliff);
  r(ctx, 240, 100, 80, 80, C.rock);
  r(ctx, 250, 110, 70, 70, C.rockMid);
  r(ctx, 270, 120, 50, 60, C.cliff);

  // Water — main body
  r(ctx, 30, 80, 260, 100, C.water);
  r(ctx, 30, 90, 260, 90, C.waterMid);

  // Water shimmer animated
  for (let i = 0; i < 8; i++) {
    const wx = 40 + i * 30;
    const wy = 95 + Math.floor(Math.sin(t * 1.2 + i * 0.8) * 3);
    r(ctx, wx, wy, 20, 1, C.waterShine);
    r(ctx, wx + 4, wy + 4, 14, 1, C.waterShine);
  }

  // Reflection ripples
  const ripple = Math.sin(t * 0.9) * 2;
  r(ctx, 80, 105 + ripple, 60, 1, C.waterShine + 'aa');
  r(ctx, 180, 108 - ripple, 50, 1, C.waterShine + '88');

  // Bridge — rickety wooden planks
  r(ctx, 30,  118, 200, 6,  C.wood);      // top rail
  r(ctx, 30,  136, 200, 6,  C.wood);      // bottom rail
  // Planks (every 12px)
  for (let i = 0; i < 17; i++) {
    const bx = 30 + i * 12;
    const sag = Math.sin(i / 16 * Math.PI) * 3; // slight sag in middle
    r(ctx, bx, 118 + sag, 10, 20 + sag, C.woodDark);
    r(ctx, bx + 2, 120 + sag, 6, 16 + sag, C.wood);
  }
  // Rope on sides
  r(ctx, 28,  108, 202, 4, C.woodDark);
  r(ctx, 28,  144, 202, 4, C.woodDark);

  // Floor beyond bridge (far shore)
  r(ctx, 220, 108, 100, 72, C.rock);
  r(ctx, 230, 118, 90,  62, C.rockMid);
  // Tunnel entrance on far shore
  r(ctx, 248, 82, 60, 100, C.cavemouth);
  r(ctx, 258, 74, 40, 10,  C.cavemouth);
  r(ctx, 266, 68, 24, 8,   C.cavemouth);

  // Mysterious eyes in water (blink occasionally)
  const blink = Math.sin(t * 0.3) > 0.8;
  if (!blink) {
    r(ctx, 120, 130, 4, 3, '#20e040');
    r(ctx, 130, 131, 4, 3, '#20e040');
    // pupils
    r(ctx, 121, 131, 2, 2, C.void);
    r(ctx, 131, 132, 2, 2, C.void);
  }

  // Dripping water from stalactites
  for (let i = 0; i < 4; i++) {
    const phase = (t * 1.5 + i * 1.6) % 3.0;
    const dy = Math.floor(phase / 3.0 * 40);
    r(ctx, 68 + i * 50, 45 + dy, 1, 3, C.waterShine + 'cc');
  }

  // Szaznak — fishing from the left bank
  drawSzaznak(ctx, 57, 148, t, 'fish');
}

// ─── Scene 5: Ancient Ruins ───────────────────────────────────────────────────

function drawAncientRuins(ctx: CanvasRenderingContext2D, t: number) {
  r(ctx, 0, 0, 320, 180, C.void);

  // Ceiling
  r(ctx, 0, 0, 320, 30, C.cliff);
  r(ctx, 0, 0, 320, 20, '#1e1828');

  // Far wall — ancient stonework
  r(ctx, 0, 30, 320, 120, C.stone);
  // Stone block pattern
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 10; col++) {
      const bx = col * 32 + (row % 2) * 16;
      const by = 30 + row * 18;
      r(ctx, bx, by, 30, 16, row % 3 === 0 ? C.cliff : C.stone);
      r(ctx, bx + 1, by + 1, 28, 14, C.stoneMid);
    }
  }

  // Floor — worn stone tiles
  r(ctx, 0, 148, 320, 32, '#1a1420');
  for (let tx = 0; tx < 320; tx += 32) {
    r(ctx, tx, 148, 30, 30, C.stone);
    r(ctx, tx + 1, 149, 28, 28, C.stoneMid);
    // Cracks
    r(ctx, tx + 10, 149, 1, 20, C.cliff);
    r(ctx, tx + 22, 153, 1, 15, C.cliff);
  }

  // Moss on floor
  dither(ctx, 0, 155, 80, 25, C.moss);
  dither(ctx, 200, 158, 100, 22, C.mossLight);

  // Left pillar
  r(ctx, 30, 45, 40, 108, C.cliff);
  r(ctx, 32, 47, 36, 104, C.stone);
  r(ctx, 34, 49, 32, 100, C.stoneMid);
  // Pillar top cap
  r(ctx, 26, 40, 48, 10, C.cliff);
  r(ctx, 28, 42, 44, 8, C.stoneLight);
  // Carvings on pillar
  r(ctx, 42, 65, 10, 3, C.rune);
  r(ctx, 44, 75, 6, 3, C.rune);
  r(ctx, 40, 85, 12, 3, C.rune);

  // Right pillar
  r(ctx, 250, 45, 40, 108, C.cliff);
  r(ctx, 252, 47, 36, 104, C.stone);
  r(ctx, 254, 49, 32, 100, C.stoneMid);
  r(ctx, 246, 40, 48, 10, C.cliff);
  r(ctx, 248, 42, 44, 8, C.stoneLight);
  r(ctx, 262, 65, 10, 3, C.rune);
  r(ctx, 264, 75, 6, 3, C.rune);
  r(ctx, 260, 85, 12, 3, C.rune);

  // Vines on left wall
  for (let i = 0; i < 8; i++) {
    r(ctx, 8 + i * 2, i * 12 + 30, 2, 14, C.moss);
    r(ctx, 14 + i * 2, i * 10 + 35, 2, 12, C.mossLight);
  }

  // Central inscription on back wall
  r(ctx, 110, 60, 100, 60, C.cliff);
  r(ctx, 112, 62, 96, 56, '#120e1e');
  // Rune symbols (3 rows)
  const runeGlowColor = Math.sin(t * 0.8) > 0.3 ? C.runeGlow : C.rune;
  r(ctx, 118, 68, 8, 6, runeGlowColor);
  r(ctx, 130, 68, 6, 6, C.rune);
  r(ctx, 140, 68, 8, 6, runeGlowColor);
  r(ctx, 152, 68, 6, 6, C.rune);
  r(ctx, 162, 68, 8, 6, runeGlowColor);
  r(ctx, 172, 68, 6, 6, C.rune);
  r(ctx, 120, 80, 6, 5, C.rune);
  r(ctx, 130, 80, 8, 5, runeGlowColor);
  r(ctx, 142, 80, 6, 5, C.rune);
  r(ctx, 152, 80, 8, 5, runeGlowColor);
  r(ctx, 164, 80, 8, 5, C.rune);
  r(ctx, 120, 92, 8, 5, runeGlowColor);
  r(ctx, 132, 92, 6, 5, C.rune);
  r(ctx, 142, 92, 10, 5, runeGlowColor);
  r(ctx, 156, 92, 6, 5, C.rune);
  r(ctx, 166, 92, 8, 5, runeGlowColor);

  // Ancient braziers (unlit, just the stand)
  // Left brazier
  r(ctx, 75, 118, 20, 4, C.cliff);   // bowl rim
  r(ctx, 77, 122, 16, 3, C.stone);   // bowl
  r(ctx, 83, 125, 4, 20, C.cliff);   // stand
  r(ctx, 79, 143, 12, 4, C.cliff);   // base
  // Right brazier
  r(ctx, 225, 118, 20, 4, C.cliff);
  r(ctx, 227, 122, 16, 3, C.stone);
  r(ctx, 233, 125, 4, 20, C.cliff);
  r(ctx, 229, 143, 12, 4, C.cliff);

  // Sleeping creature — bottom-right corner
  const breathe = Math.sin(t * 0.6) * 1; // slow breathing
  // Body (blob shape)
  r(ctx, 196, 136 + breathe, 80, 30, C.creatureD);
  r(ctx, 200, 132 + breathe, 72, 28, C.creature);
  r(ctx, 204, 130 + breathe, 64, 26, '#6a3030');
  // Head
  r(ctx, 196, 128 + breathe, 32, 22, C.creature);
  r(ctx, 198, 126 + breathe, 28, 20, '#6a3030');
  // Snout
  r(ctx, 186, 136 + breathe, 16, 12, C.creature);
  // Nostril puffs (breathing animation)
  const snortPhase = Math.sin(t * 0.6);
  if (snortPhase > 0.8) {
    r(ctx, 180, 134 + breathe, 4, 2, C.dim + '88');
    r(ctx, 181, 132 + breathe, 2, 2, C.dim + '44');
  }
  // Closed eye
  r(ctx, 200, 130 + breathe, 8, 3, C.creatureD);
  // Tail curl
  r(ctx, 268, 148, 20, 8,  C.creature);
  r(ctx, 274, 144, 10, 10, C.creature);
  r(ctx, 278, 140, 6,  8,  C.creatureD);
  // Scales / texture
  dither(ctx, 200, 132 + breathe, 70, 24, C.creatureD);

  // Stone throne for Szaznak (between the pillars)
  r(ctx, 130, 118, 60, 34, C.cliff);
  r(ctx, 132, 120, 56, 30, C.stone);
  r(ctx, 134, 122, 52, 28, C.stoneMid);
  // Throne seat
  r(ctx, 128, 140, 64, 8, C.cliff);
  r(ctx, 130, 141, 60, 7, C.stoneLight);
  // Armrests
  r(ctx, 124, 128, 10, 20, C.cliff);
  r(ctx, 186, 128, 10, 20, C.cliff);
  r(ctx, 125, 129, 8, 18, C.stone);
  r(ctx, 187, 129, 8, 18, C.stone);
  // Throne back carvings (rune-ish)
  r(ctx, 140, 124, 6, 4, C.rune);
  r(ctx, 150, 124, 4, 4, C.rune);
  r(ctx, 158, 124, 6, 4, C.rune);

  // Szaznak — sitting on his throne like he owns the place (he does)
  drawSzaznak(ctx, 160, 148, t, 'throne');
}

// ─── Pit Room helpers ────────────────────────────────────────────────────────

function poly(ctx: CanvasRenderingContext2D, pts: [number, number][], fill: string) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fill();
}

function seg(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

// Arching wooden bridge from (x1,y1) to (x2,y2) on screen
function isoBridge(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  x2: number, y2: number,
  arcH: number,
  thick: number,
) {
  const N = 10;
  const top: [number, number][] = [];
  const bot: [number, number][] = [];
  for (let i = 0; i <= N; i++) {
    const tt = i / N;
    const bx = Math.round(x1 + (x2 - x1) * tt);
    const by = Math.round(y1 + (y2 - y1) * tt - Math.sin(tt * Math.PI) * arcH);
    top.push([bx, by]);
    bot.push([bx, by + thick]);
  }
  // Top face
  poly(ctx, [...top, ...[...bot].reverse()], C.wood);
  // Darker underside (left and right ramp faces)
  poly(ctx, [top[0], bot[0], [bot[0][0], bot[0][1] + 4], [top[0][0], top[0][1] + 4]], C.woodDark);
  poly(ctx, [top[N], bot[N], [bot[N][0], bot[N][1] + 4], [top[N][0], top[N][1] + 4]], C.woodDark);
  // Plank separator lines
  ctx.strokeStyle = C.woodDark;
  ctx.lineWidth = 1;
  for (let i = 1; i < N; i++) {
    ctx.beginPath();
    ctx.moveTo(top[i][0], top[i][1]);
    ctx.lineTo(bot[i][0], bot[i][1]);
    ctx.stroke();
  }
  // Top and bottom edge outlines
  ctx.strokeStyle = '#3a1a06';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(top[0][0], top[0][1]);
  for (const p of top) ctx.lineTo(p[0], p[1]);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(bot[0][0], bot[0][1]);
  for (const p of bot) ctx.lineTo(p[0], p[1]);
  ctx.stroke();
}

function bonePile(ctx: CanvasRenderingContext2D, x: number, y: number, v: number) {
  const b = '#c0b89a';
  const bd = '#8a8070';
  if (v === 0) {
    // skull left, long bones spread wide
    r(ctx, x-2, y-2, 4, 3, b);  r(ctx, x-1, y-3, 2, 1, b);  r(ctx, x, y-1, 1, 1, bd);
    r(ctx, x-7, y,   8, 1, b);  r(ctx, x-4, y+2, 7, 1, b);
    r(ctx, x+2, y-3, 1, 5, bd); r(ctx, x-5, y-2, 1, 4, bd);
    r(ctx, x-3, y+3, 4, 1, bd); r(ctx, x+1, y+4, 3, 1, bd);
  } else if (v === 1) {
    // skull upright/tilted, bones stacked vertically
    r(ctx, x-1, y-4, 3, 4, b);  r(ctx, x, y-5, 2, 1, b);    r(ctx, x, y-2, 1, 1, bd);
    r(ctx, x-3, y,   1, 6, b);  r(ctx, x+2, y+1, 1, 5, b);
    r(ctx, x-5, y+1, 6, 1, bd); r(ctx, x-4, y+4, 5, 1, bd);
    r(ctx, x+3, y-1, 3, 1, bd); r(ctx, x+3, y+2, 1, 3, bd);
  } else if (v === 2) {
    // skull center, bones radiating outward
    r(ctx, x-2, y-1, 4, 3, b);  r(ctx, x-1, y-2, 2, 1, b);  r(ctx, x+1, y, 1, 1, bd);
    r(ctx, x-7, y,   5, 1, b);  r(ctx, x+3, y+1, 5, 1, b);
    r(ctx, x-1, y+2, 1, 5, bd); r(ctx, x+1, y-5, 1, 4, bd);
    r(ctx, x-5, y+3, 3, 1, bd); r(ctx, x+2, y+5, 4, 1, bd);
  } else {
    // skull to the right, mostly a jumble of long bones
    r(ctx, x+2, y,   3, 3, b);  r(ctx, x+3, y-1, 2, 1, b);  r(ctx, x+3, y+1, 1, 1, bd);
    r(ctx, x-7, y-2, 9, 1, b);  r(ctx, x-5, y+1, 8, 1, b);  r(ctx, x-4, y+3, 6, 1, b);
    r(ctx, x-2, y-4, 1, 4, bd); r(ctx, x+1, y+4, 1, 3, bd);
    r(ctx, x-4, y+5, 5, 1, bd);
  }
}

// Enemy soldier in Napoleonic red coat
function redSoldier(ctx: CanvasRenderingContext2D, cx: number, by: number, t: number) {
  const bob = Math.round(Math.sin(t * 1.8) * 0.5);
  const fy = by + bob;
  // Legs (white trousers)
  r(ctx, cx - 3, fy - 10, 2, 10, '#e8e0d0');
  r(ctx, cx + 1,  fy - 10, 2, 10, '#e8e0d0');
  // Black boots
  r(ctx, cx - 3, fy - 2, 2, 2, '#181410');
  r(ctx, cx + 1, fy - 2, 2, 2, '#181410');
  // Red coat body
  r(ctx, cx - 4, fy - 21, 8, 12, '#c01818');
  r(ctx, cx - 3, fy - 22, 6, 2,  '#c01818');
  // Gold trim lines
  r(ctx, cx - 4, fy - 21, 1, 12, '#d4a820');
  r(ctx, cx + 3,  fy - 21, 1, 12, '#d4a820');
  r(ctx, cx - 2, fy - 18, 4, 1,  '#d4a820');
  r(ctx, cx - 2, fy - 15, 4, 1,  '#d4a820');
  // Epaulettes
  r(ctx, cx - 6, fy - 22, 4, 3, '#d4a820');
  r(ctx, cx + 2,  fy - 22, 4, 3, '#d4a820');
  // White cross-belts
  r(ctx, cx - 3, fy - 21, 1, 11, '#e8e0d0');
  r(ctx, cx + 2, fy - 21, 1, 11, '#e8e0d0');
  // Face
  r(ctx, cx - 2, fy - 27, 4, 5, '#c89070');
  r(ctx, cx - 1, fy - 25, 1, 1, '#1a0808');
  r(ctx, cx + 1,  fy - 25, 1, 1, '#1a0808');
  // Black shako hat
  r(ctx, cx - 3, fy - 30, 6, 4, '#181410');
  r(ctx, cx - 2, fy - 29, 4, 3, '#28221c');
  r(ctx, cx - 4, fy - 28, 8, 1, '#181410'); // brim
  // Red plume
  r(ctx, cx,     fy - 33, 2, 5, '#c01818');
  r(ctx, cx + 1, fy - 36, 1, 4, '#c01818');
  // Musket
  r(ctx, cx + 5, fy - 31, 1, 27, '#5a4030');
  r(ctx, cx + 5, fy - 23, 2, 2,  '#909080'); // lock
}

function pitRoomChest(ctx: CanvasRenderingContext2D, x: number, y: number, t: number) {
  const glint = Math.sin(t * 1.8);
  if (glint > 0.4) dither(ctx, x - 4, y - 10, 24, 22, C.torchB + '44');
  // Body
  r(ctx, x, y, 16, 10, C.woodDark);
  r(ctx, x + 1, y + 1, 14, 8, '#7a4818');
  // Gold straps
  r(ctx, x, y + 3, 16, 2, C.gold);
  r(ctx, x + 7, y, 2, 10, C.gold);
  // Lid (cracked open)
  r(ctx, x, y - 5, 16, 6, C.woodDark);
  r(ctx, x + 1, y - 4, 14, 5, '#7a4818');
  r(ctx, x, y - 4, 16, 2, C.gold);
  // Lock
  r(ctx, x + 5, y - 2, 6, 5, C.gold);
  r(ctx, x + 6, y - 1, 4, 3, C.rune);
  // Animated glints
  if (glint > 0.3) r(ctx, x + 3, y - 9, 2, 2, C.torchC);
  if (Math.sin(t * 1.5 + 1) > 0.3) r(ctx, x + 10, y - 8, 2, 2, C.torchB);
  if (Math.sin(t * 1.2 + 2) > 0.5) r(ctx, x + 7,  y - 11, 2, 2, C.torchC);
}

function pitRoomBones(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const b = '#bab29a';
  const bd = '#8a8272';
  r(ctx, x, y, 16, 2, b);
  r(ctx, x + 2, y - 2, 2, 7, b);
  r(ctx, x + 8, y - 4, 11, 2, b);
  r(ctx, x + 5, y - 1, 2, 6, bd);
  r(ctx, x - 2, y + 1, 8, 2, bd);
  r(ctx, x + 11, y + 1, 7, 2, b);
  // Skull
  r(ctx, x + 6, y - 8, 6, 5, b);
  r(ctx, x + 7, y - 9, 4, 2, b);
  r(ctx, x + 7, y - 4, 2, 1, '#1a1010');
  r(ctx, x + 10, y - 4, 2, 1, '#1a1010');
}

function pitRoomSecretDoor(ctx: CanvasRenderingContext2D, x: number, y: number, t: number) {
  const glow = Math.sin(t * 0.7) * 0.5 + 0.5;
  if (glow > 0.5) dither(ctx, x - 6, y - 2, 46, 50, C.torchA + '33');
  // Stone surround (isometric wall face)
  r(ctx, x, y, 34, 46, C.cliff);
  r(ctx, x + 1, y + 1, 32, 44, C.stone);
  // Arch opening (orange)
  r(ctx, x + 4, y + 14, 26, 28, '#d86010'); // door body
  r(ctx, x + 5, y + 15, 24, 26, '#e87020'); // door face
  // Arch top (rounded with stacked rects)
  r(ctx, x + 10, y + 6,  14, 10, '#d86010');
  r(ctx, x + 8,  y + 8,  18, 8,  '#d86010');
  r(ctx, x + 6,  y + 11, 22, 5,  '#d86010');
  r(ctx, x + 11, y + 7,  12, 9,  '#e87020');
  r(ctx, x + 9,  y + 9,  16, 7,  '#e87020');
  r(ctx, x + 7,  y + 12, 20, 4,  '#e87020');
  // Door panel detail
  r(ctx, x + 7, y + 18, 10, 14, '#f08030');
  r(ctx, x + 19, y + 18, 10, 14, '#f08030');
  // Keyhole
  r(ctx, x + 15, y + 27, 4, 5, '#1a0808');
  r(ctx, x + 16, y + 32, 2, 5, '#1a0808');
  // Small window / light (glowing)
  r(ctx, x + 14, y + 9, 6, 5, glow > 0.6 ? C.torchC : C.torchB);
  // Handle
  r(ctx, x + 28, y + 26, 4, 2, C.gold);
  r(ctx, x + 30, y + 25, 2, 4, C.gold);
}

// ─── Scene 6: The Pit Room (isometric) ────────────────────────────────────────

function drawPitRoom(ctx: CanvasRenderingContext2D, t: number) {
  r(ctx, 0, 0, 320, 180, '#06050c');

  // Stalactites from ceiling (draw first, they're above everything)
  stalactite(ctx, 55, 0, 9, 18, C.cliff);
  stalactite(ctx, 108, 0, 7, 15, C.rock);
  stalactite(ctx, 168, 0, 11, 22, C.cliff);
  stalactite(ctx, 230, 0, 7, 14, C.rock);
  stalactite(ctx, 282, 0, 9, 18, C.cliff);

  // ── Floor ──────────────────────────────────────────────────────────────────
  // Room: near vertex at bottom, left/right at sides, far vertex at top
  const NEAR: [number, number] = [160, 178];
  const LEFT: [number, number] = [12, 115];
  const FAR:  [number, number] = [175, 28];
  const RGHT: [number, number] = [308, 122];

  poly(ctx, [NEAR, RGHT, FAR, LEFT], '#38304a'); // main floor

  // Isometric floor grid (two sets of diagonal lines)
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#48405a';
  // Lines parallel to LEFT–NEAR edge (going "right" in the room)
  const isoRight: [[number,number],[number,number]][] = [
    [[12,115],[160,178]], [[40,100],[188,163]], [[68,85],[216,148]],
    [[96,70],[244,133]], [[124,55],[272,118]], [[152,40],[300,103]],
  ];
  // Lines parallel to RGHT–NEAR edge (going "back-left")
  const isoBack: [[number,number],[number,number]][] = [
    [[308,122],[160,178]], [[284,107],[136,163]], [[260,92],[112,148]],
    [[236,77],[88,133]], [[212,62],[64,118]], [[188,47],[40,103]], [[175,28],[20,86]],
  ];
  for (const [[x1,y1],[x2,y2]] of [...isoRight, ...isoBack]) {
    seg(ctx, x1, y1, x2, y2, '#48405a');
  }

  // ── Back-left wall tint ─────────────────────────────────────────────────────
  // Slightly different shade to distinguish the back pocket area
  poly(ctx, [LEFT, [68,85], [148,68], [106,40], [12,72]], '#2e2840');

  // ── Secret door (upper-right wall — draw before soldiers so it's behind them) ──
  pitRoomSecretDoor(ctx, 252, 32, t);

  // ── Back-left area: bones, chests, treasure pile, Szaznak ──────────────────
  pitRoomBones(ctx, 24, 96);
  pitRoomChest(ctx, 44, 86, t);
  pitRoomChest(ctx, 22, 80, t);
  r(ctx, 28, 90, 6, 2, C.gold); r(ctx, 36, 93, 4, 2, C.gold); r(ctx, 22, 95, 8, 2, C.gold);
  r(ctx, 30, 96, 5, 2, C.gold); r(ctx, 40, 95, 4, 2, C.gold); r(ctx, 34, 99, 6, 2, C.gold);
  r(ctx, 20, 88, 2, 2, '#e04060'); r(ctx, 25, 91, 2, 2, '#40b0e0'); r(ctx, 30, 88, 2, 2, '#60d080');
  r(ctx, 35, 91, 2, 2, '#e04060'); r(ctx, 40, 88, 2, 2, '#40b0e0'); r(ctx, 45, 91, 2, 2, '#60d080');
  drawSzaznak(ctx, 54, 104, t, 'stand');

  // ── Pit (long diagonal ditch, upper-left → lower-right) ─────────────────────
  const PA: [number,number] = [56,  90];
  const PB: [number,number] = [104, 62];
  const PC: [number,number] = [258, 138];
  const PD: [number,number] = [210, 166];
  const DEPTH = 18;
  const dn = ([x,y]: [number,number]): [number,number] => [x, y + DEPTH];

  poly(ctx, [PA, PB, PC, PD], '#100806');                          // opening
  poly(ctx, [PB, PC, dn(PC), dn(PB)], '#140a04');                 // far long wall
  poly(ctx, [PA, PB, dn(PB), dn(PA)], '#1a0e06');                 // upper-left end cap
  poly(ctx, [dn(PA), dn(PB), dn(PC), dn(PD)], '#040308');         // bottom
  bonePile(ctx, 118, 108, 0);
  bonePile(ctx, 145, 116, 1);
  bonePile(ctx, 172, 112, 2);
  bonePile(ctx, 198, 105, 3);
  r(ctx, 128, 104, 8, 1, '#c0b89a'); r(ctx, 157, 99, 10, 1, '#c0b89a');
  poly(ctx, [PD, PC, dn(PC), dn(PD)], '#221208');                 // lower-right end cap
  poly(ctx, [PA, PD, dn(PD), dn(PA)], '#2c1808');                 // near long wall
  seg(ctx, PA[0], PA[1]+6,  PD[0], PD[1]+6,  '#3c2410');          // stone courses
  seg(ctx, PA[0], PA[1]+12, PD[0], PD[1]+12, '#3c2410');
  seg(ctx, PA[0], PA[1]+17, PD[0], PD[1]+17, '#3c2410');
  seg(ctx, PA[0], PA[1], PB[0], PB[1], '#504038');                // rim highlight
  seg(ctx, PB[0], PB[1], PC[0], PC[1], '#504038');
  seg(ctx, PC[0], PC[1], PD[0], PD[1], '#504038');
  seg(ctx, PD[0], PD[1], PA[0], PA[1], '#504038');

  // ── Soldiers (right of strip, near upper bridge end) ─────────────────────────
  redSoldier(ctx, 262, 92, t);
  redSoldier(ctx, 280, 82, t + 0.65);

  // ── Bridges over the pit ──────────────────────────────────────────────────────
  isoBridge(ctx, 40, 130, 182, 64, 22, 8);   // bridge 1 (upper-left portion of strip)
  isoBridge(ctx, 116, 162, 260, 94, 14, 7);  // bridge 2 (lower-right portion of strip)

  // ── Entrance shadow at bottom ───────────────────────────────────────────────
  r(ctx, 130, 165, 60, 13, '#08060e');
  r(ctx, 140, 168, 40, 10, C.cavemouth);
}

// ─── Scene definitions ────────────────────────────────────────────────────────

export const SCENES: Scene[] = [
  {
    id: 'entrance',
    draw: drawEntrance,
    hotspots: [
      // Szaznak first so he takes click priority over the cave mouth behind him
      {
        x: 72, y: 143, w: 50, h: 36,
        label: 'Szaznak',
        message: 'SZAZNAK: "Ah. A visitor. How... uninvited. I love it. Come in. Wipe your feet. Not on me."',
      },
      {
        x: 70, y: 12, w: 180, h: 168,
        label: 'Enter the cave',
        goto: 'chamber',
        transitionType: 1,
      },
      {
        x: 164, y: 128, w: 56, h: 24,
        label: 'Read sign',
        message: '"NO CAVES." Someone put this up. Szaznak ate the person who put this up.',
      },
    ],
  },
  {
    id: 'chamber',
    draw: drawMainChamber,
    hotspots: [
      {
        x: 136, y: 116, w: 50, h: 36,
        label: 'Szaznak',
        message: 'SZAZNAK: "Left is crystals. Right is the lake. Straight ahead is me, judging you. I\'m always here."',
      },
      {
        x: 0, y: 64, w: 60, h: 86,
        label: 'Crystals this way',
        goto: 'crystals',
        transitionType: 0,
      },
      {
        x: 260, y: 64, w: 60, h: 86,
        label: 'Into the dark',
        goto: 'lake',
        transitionType: 3,
      },
      {
        x: 100, y: 100, w: 36, h: 45,
        label: 'Sniff the air',
        message: 'Smells ancient. Also mildly of cheese. Szaznak says that\'s his.',
      },
      {
        x: 118, y: 52, w: 84, h: 60,
        label: 'Into the deeper dark',
        goto: 'pitroom',
        transitionType: 2,
      },
    ],
  },
  {
    id: 'crystals',
    draw: drawCrystalRoom,
    hotspots: [
      {
        x: 131, y: 116, w: 50, h: 36,
        label: 'Szaznak',
        message: 'SZAZNAK: *vibrating intensely* "I HAVE BEEN IN HERE FOR THREE DAYS. THE CRYSTALS SING TO ME. I CANNOT LEAVE. I DO NOT WANT TO LEAVE."',
      },
      {
        x: 68, y: 60, w: 80, h: 90,
        label: 'Touch crystal',
        message: 'You lick it instead. Tastes purple. Deeply, disturbingly purple.',
      },
      {
        x: 190, y: 60, w: 68, h: 90,
        label: 'Take crystal',
        message: "It vibrates angrily. Szaznak glares at you. You put it back. The crystal vibrates with satisfaction.",
      },
      {
        x: 100, y: 150, w: 120, h: 28,
        label: 'Go back',
        goto: 'chamber',
        transitionType: 2,
      },
    ],
  },
  {
    id: 'lake',
    draw: drawUndergroundLake,
    hotspots: [
      {
        x: 33, y: 116, w: 50, h: 36,
        label: 'Szaznak',
        message: 'SZAZNAK: "I\'ve been fishing for 400 years. Gerald has never taken the bait. I respect him. He is my nemesis."',
      },
      {
        x: 30, y: 106, w: 200, h: 42,
        label: 'Cross the bridge',
        goto: 'ruins',
        transitionType: 0,
      },
      {
        x: 100, y: 120, w: 80, h: 40,
        label: 'Look at water',
        message: 'The water stares back. Gerald (the thing in the water) does not blink. Gerald has not blinked since 1987.',
      },
      {
        x: 0, y: 0, w: 35, h: 105,
        label: 'Go back',
        goto: 'chamber',
        transitionType: 2,
      },
    ],
  },
  {
    id: 'ruins',
    draw: drawAncientRuins,
    hotspots: [
      {
        x: 136, y: 116, w: 50, h: 36,
        label: 'Szaznak',
        message: 'SZAZNAK: "This is my throne. I found it. It was just sitting here. The previous owner is that thing in the corner. It still technically owns it but it won\'t wake up so."',
      },
      {
        x: 108, y: 58, w: 104, h: 54,
        label: 'Read inscription',
        message: '"WHOEVER READS THIS IS A BIG NERD." — Szaznak carved this himself last Tuesday.',
      },
      {
        x: 186, y: 124, w: 96, h: 44,
        label: 'Disturb creature',
        message: "One eye opens. It sees you. It sees Szaznak on the throne. It sighs. It goes back to sleep. It has given up.",
      },
      {
        x: 0, y: 0, w: 30, h: 180,
        label: 'Go back',
        goto: 'lake',
        transitionType: 3,
      },
    ],
  },
  {
    id: 'pitroom',
    draw: drawPitRoom,
    hotspots: [
      // Szaznak in the back-left corner
      {
        x: 30, y: 72, w: 50, h: 36,
        label: 'Szaznak',
        message: 'SZAZNAK: "Yes, I\'m aware of the soldiers. They have been standing there for three weeks. They haven\'t moved. I think they\'re scared of the pit. I think the pit is winning."',
      },
      // Treasure pile
      {
        x: 16, y: 68, w: 50, h: 36,
        label: 'Treasure pile',
        message: 'Two chests, overflowing with gold coins and glittering gems. Szaznak has counted every single one. He has also named them. He will not tell you their names.',
      },
      // Pit
      {
        x: 54, y: 60, w: 208, h: 110,
        label: 'Look into the pit',
        message: 'You peer over the edge. The skeletons look back. One of them has been there so long it\'s arranged itself into a little chair. A tiny throne. Szaznak is furious.',
      },
      // Enemy soldiers
      {
        x: 248, y: 68, w: 60, h: 38,
        label: 'Approach soldiers',
        message: 'SOLDIER: "Halt! Who goes—" He looks at Szaznak. He looks at the pit. He looks at you. "...carry on." They have given up.',
      },
      // Secret door
      {
        x: 250, y: 30, w: 58, h: 54,
        label: 'Examine the door',
        message: 'An orange door. It is warm to the touch. There is a keyhole shaped like a small demon. You do not have the key. Szaznak says he lost it in 1987.',
      },
      // Bridge 1
      {
        x: 36, y: 62, w: 148, h: 72,
        label: 'Cross the upper bridge',
        message: 'The bridge creaks. You get across. You then realize the bridge goes from one side of the pit to the other side of the pit. You are now just on the other side of the pit.',
      },
      // Bridge 2
      {
        x: 112, y: 92, w: 152, h: 74,
        label: 'Cross the lower bridge',
        message: 'You cross the lower bridge with confidence. It barely creaks. You feel good about yourself. The skeletons below slow-clap. Bone-style.',
      },
      // Go back
      {
        x: 120, y: 160, w: 80, h: 20,
        label: 'Leave (back to chamber)',
        goto: 'chamber',
        transitionType: 2,
      },
    ],
  },
];

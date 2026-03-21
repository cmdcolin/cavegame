import { POST_SHADER, TRANS_SHADER } from './shaders';

export const W = 320;
export const H = 180;
const TRANS_MS = 1100;

export class Engine {
  private device: GPUDevice;
  private ctx: GPUCanvasContext;
  private fmt: GPUTextureFormat;
  private fromTex: GPUTexture;
  private toTex: GPUTexture;
  private samp: GPUSampler;
  private postPipeline: GPURenderPipeline;
  private transPipeline: GPURenderPipeline;
  private postUniform: GPUBuffer;
  private transUniform: GPUBuffer;

  private _transitioning = false;
  private transStart = 0;
  private transType = 0;

  onTransitionEnd: (() => void) | null = null;

  get transitioning() { return this._transitioning; }

  static async init(canvas: HTMLCanvasElement) {
    if (!navigator.gpu) throw new Error('WebGPU not supported in this browser');
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) throw new Error('No WebGPU adapter found');
    const device = await adapter.requestDevice();
    return new Engine(device, canvas);
  }

  private constructor(device: GPUDevice, canvas: HTMLCanvasElement) {
    this.device = device;
    const gpuCtx = canvas.getContext('webgpu');
    if (!gpuCtx) throw new Error('Could not get WebGPU context');
    this.ctx = gpuCtx;
    this.fmt = navigator.gpu.getPreferredCanvasFormat();
    this.ctx.configure({ device, format: this.fmt, alphaMode: 'opaque' });

    const texDesc: GPUTextureDescriptor = {
      size: [W, H],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    };
    this.fromTex = device.createTexture(texDesc);
    this.toTex = device.createTexture(texDesc);
    this.samp = device.createSampler({ magFilter: 'nearest', minFilter: 'nearest' });

    this.postUniform = device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.transUniform = device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const mkPipeline = (code: string) => {
      const module = device.createShaderModule({ code });
      return device.createRenderPipeline({
        layout: 'auto',
        vertex: { module, entryPoint: 'vs' },
        fragment: { module, entryPoint: 'fs', targets: [{ format: this.fmt }] },
        primitive: { topology: 'triangle-list' },
      });
    };
    this.postPipeline = mkPipeline(POST_SHADER);
    this.transPipeline = mkPipeline(TRANS_SHADER);
  }

  private upload(tex: GPUTexture, canvas: HTMLCanvasElement) {
    const ctx2d = canvas.getContext('2d')!;
    const data = ctx2d.getImageData(0, 0, W, H);
    this.device.queue.writeTexture(
      { texture: tex },
      data.data,
      { bytesPerRow: W * 4 },
      [W, H],
    );
  }

  // Call with the old scene still on canvas, before drawing the new one
  snapshotFrom(canvas: HTMLCanvasElement) {
    this.upload(this.fromTex, canvas);
  }

  // Call after the new scene has been drawn to canvas
  beginTransition(canvas: HTMLCanvasElement, type: number, now: number) {
    this.upload(this.toTex, canvas);
    this._transitioning = true;
    this.transStart = now;
    this.transType = type;
  }

  // Upload current scene to toTex (for static display, call once per scene change)
  setScene(canvas: HTMLCanvasElement) {
    this.upload(this.toTex, canvas);
  }

  render(now: number) {
    const enc = this.device.createCommandEncoder();
    const view = this.ctx.getCurrentTexture().createView();
    const pass = enc.beginRenderPass({
      colorAttachments: [{
        view,
        loadOp: 'clear',
        storeOp: 'store',
        clearValue: [0, 0, 0, 1],
      }],
    });

    if (this._transitioning) {
      const progress = Math.min(1, (now - this.transStart) / TRANS_MS);
      if (progress >= 1) {
        this._transitioning = false;
        this.onTransitionEnd?.();
      }
      this.device.queue.writeBuffer(
        this.transUniform, 0,
        new Float32Array([progress, this.transType, 0, 0]),
      );
      pass.setPipeline(this.transPipeline);
      pass.setBindGroup(0, this.device.createBindGroup({
        layout: this.transPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: this.fromTex.createView() },
          { binding: 1, resource: this.toTex.createView() },
          { binding: 2, resource: this.samp },
          { binding: 3, resource: { buffer: this.transUniform } },
        ],
      }));
    } else {
      this.device.queue.writeBuffer(
        this.postUniform, 0,
        new Float32Array([now * 0.001, 0.5, 0.28, 0.016]),
      );
      pass.setPipeline(this.postPipeline);
      pass.setBindGroup(0, this.device.createBindGroup({
        layout: this.postPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: this.toTex.createView() },
          { binding: 1, resource: this.samp },
          { binding: 2, resource: { buffer: this.postUniform } },
        ],
      }));
    }

    pass.draw(6);
    pass.end();
    this.device.queue.submit([enc.finish()]);
  }
}

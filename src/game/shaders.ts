// Post-processing: scanlines + vignette + film grain, always on
export const POST_SHADER = `
struct V { @builtin(position) p: vec4f, @location(0) uv: vec2f }

@vertex fn vs(@builtin(vertex_index) i: u32) -> V {
  var pos = array<vec2f,6>(
    vec2f(-1,-1), vec2f(1,-1), vec2f(1,1),
    vec2f(-1,-1), vec2f(1,1), vec2f(-1,1)
  );
  var uvs = array<vec2f,6>(
    vec2f(0,1), vec2f(1,1), vec2f(1,0),
    vec2f(0,1), vec2f(1,0), vec2f(0,0)
  );
  return V(vec4f(pos[i], 0, 1), uvs[i]);
}

@group(0) @binding(0) var tex: texture_2d<f32>;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var<uniform> p: vec4f; // time, scanlines, vignette, noise

fn hash(q: vec2f) -> f32 { return fract(sin(dot(q, vec2f(127.1, 311.7))) * 43758.5453); }

@fragment fn fs(in: V) -> @location(0) vec4f {
  var c = textureSample(tex, samp, in.uv).rgb;
  // Scanlines at game-pixel level (180 rows)
  if (u32(in.uv.y * 180.0) % 2u == 0u) { c *= 1.0 - p.y * 0.22; }
  // Vignette
  let vc = in.uv * 2.0 - 1.0;
  c *= max(0.0, 1.0 - dot(vc * vc, vec2f(p.z)));
  // Film grain
  c += (hash(in.uv + vec2f(p.x * 0.07)) - 0.5) * p.w;
  return vec4f(clamp(c, vec3f(0), vec3f(1)), 1.0);
}
`;

// Transition between two textures — 4 effect types
export const TRANS_SHADER = `
struct V { @builtin(position) p: vec4f, @location(0) uv: vec2f }

@vertex fn vs(@builtin(vertex_index) i: u32) -> V {
  var pos = array<vec2f,6>(
    vec2f(-1,-1), vec2f(1,-1), vec2f(1,1),
    vec2f(-1,-1), vec2f(1,1), vec2f(-1,1)
  );
  var uvs = array<vec2f,6>(
    vec2f(0,1), vec2f(1,1), vec2f(1,0),
    vec2f(0,1), vec2f(1,0), vec2f(0,0)
  );
  return V(vec4f(pos[i], 0, 1), uvs[i]);
}

@group(0) @binding(0) var fromTex: texture_2d<f32>;
@group(0) @binding(1) var toTex: texture_2d<f32>;
@group(0) @binding(2) var samp: sampler;
@group(0) @binding(3) var<uniform> params: vec4f; // progress, type, _, _

fn bayer(q: vec2u) -> f32 {
  var m = array<f32,16>(
    0., 8., 2., 10.,
    12., 4., 14., 6.,
    3., 11., 1., 9.,
    15., 7., 13., 5.
  );
  return m[(q.y % 4u) * 4u + (q.x % 4u)] / 16.0;
}

fn rng(q: vec2u) -> f32 {
  let n = (q.x * 1973u + q.y * 9277u) ^ 26699u;
  let m = (n ^ (n >> 16u)) * 0x45d9f3bu;
  return f32(m & 0xffffu) / 65535.0;
}

@fragment fn fs(in: V) -> @location(0) vec4f {
  let t = params.x;
  let tp = u32(params.y);
  let pp = vec2u(in.p.xy);

  // 0: Bayer 4x4 ordered dither dissolve
  if tp == 0u {
    if t > bayer(pp) { return textureSample(toTex, samp, in.uv); }
    return textureSample(fromTex, samp, in.uv);
  }
  // 1: Pixelate zoom (peaks at mid-transition, then resolves to new scene)
  if tp == 1u {
    let bs = max(1.0, sin(t * 3.14159) * 24.0);
    let pu = vec2f(
      floor(in.uv.x * 320.0 / bs) * bs / 320.0,
      floor(in.uv.y * 180.0 / bs) * bs / 180.0
    );
    if t < 0.5 { return textureSample(fromTex, samp, pu); }
    return textureSample(toTex, samp, pu);
  }
  // 2: Random 8x8 block dissolve
  if tp == 2u {
    if t > rng(vec2u(pp.x / 8u, pp.y / 8u)) { return textureSample(toTex, samp, in.uv); }
    return textureSample(fromTex, samp, in.uv);
  }
  // 3: Glitchy horizontal scanline wipe with per-line jitter
  if tp == 3u {
    let jitter = (rng(vec2u(pp.y / 3u, 42u)) - 0.5) * 0.12;
    if t + jitter > in.uv.x { return textureSample(toTex, samp, in.uv); }
    return textureSample(fromTex, samp, in.uv);
  }
  return mix(textureSample(fromTex, samp, in.uv), textureSample(toTex, samp, in.uv), t);
}
`;


struct Params { time: f32 };
@group(0) @binding(0) var<uniform> params: Params;

const TAU = 6.2831853;
// GitHub's dark canvas. Every piece starts here and only ever adds light, so
// the edges of the image dissolve into the page instead of drawing a box.
const PAGE = vec3f(0.051, 0.0667, 0.0902);

fn hash21(p: vec2f) -> f32 {
  var p3 = fract(vec3f(p.x, p.y, p.x) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

fn vnoise(p: vec2f) -> f32 {
  let i = floor(p);
  let g = fract(p);
  let u = g * g * (3.0 - 2.0 * g);
  return mix(
    mix(hash21(i), hash21(i + vec2f(1.0, 0.0)), u.x),
    mix(hash21(i + vec2f(0.0, 1.0)), hash21(i + vec2f(1.0, 1.0)), u.x),
    u.y);
}

fn fbm(p: vec2f) -> f32 {
  var value = 0.0;
  var amplitude = 0.5;
  var q = p;
  for (var i = 0; i < 5; i++) {
    value += amplitude * vnoise(q);
    q = q * 2.02 + vec2f(1.7, 9.2);
    amplitude *= 0.5;
  }
  return value;
}

fn palette(t: f32) -> vec3f {
  let a = clamp(t, 0.0, 1.0);
  let deep = mix(vec3f(0.03, 0.05, 0.16), vec3f(0.10, 0.32, 0.78), smoothstep(0.0, 0.45, a));
  let mid = mix(deep, vec3f(0.32, 0.55, 0.98), smoothstep(0.35, 0.68, a));
  let hot = mix(mid, vec3f(0.92, 0.38, 0.85), smoothstep(0.62, 0.86, a));
  return mix(hot, vec3f(1.0, 0.93, 0.85), smoothstep(0.88, 1.0, a));
}

const RES = vec2f(960.0, 18.0);
const SEED = 21.9;

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let px = uv * RES;
  let phase = params.time * TAU;

  // The line itself wanders by a pixel or so, which is what stops it reading as
  // a border and starts it reading as something alive.
  let wander = (fbm(vec2f(px.x * 0.006 + SEED, cos(phase) * 0.5)) - 0.5) * RES.y * 0.55;
  let d = abs(px.y - RES.y * 0.5 - wander);

  let core = exp(-d * 2.6);
  let halo = exp(-d * 0.45);

  // Charge sweeping along the filament, off both ends at the seam of the loop.
  let head = params.time * (RES.x + 600.0) - 300.0;
  let charge = exp(-abs(px.x - head) / 90.0);
  let trail = exp(-max(0.0, head - px.x) / 260.0) * 0.35;

  let energy = 0.10 + 0.35 * fbm(vec2f(px.x * 0.01 - SEED, sin(phase) * 0.6)) + charge + trail;
  var filament = palette(0.35 + 0.6 * energy) * (core * (0.5 + 1.6 * energy) + halo * 0.18 * energy);

  // Fade both ends so the strip has no hard edges against the page.
  filament *= smoothstep(0.0, 0.12, uv.x) * smoothstep(1.0, 0.88, uv.x);
  var color = PAGE + filament + (hash21(px) - 0.5) * 0.004;

  return vec4f(clamp(color, vec3f(0.0), vec3f(1.0)), 1.0);
}

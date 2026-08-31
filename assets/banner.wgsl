
struct Params { time: f32 };
@group(0) @binding(0) var<uniform> params: Params;

const TAU = 6.2831853;
// GitHub's dark canvas. Every piece starts here and only ever adds light, so
// the edges of the image dissolve into the page instead of drawing a box.
const PAGE = vec3f(0.051, 0.0667, 0.0902);
const RES = vec2f(960.0, 288.0);
const COLS = 53;
const ROWS = 7;
const CELL = 16.6642;
const GRID = vec2f(38.4, 85.6755);
const TEXT = vec2f(73.4545, 100.2182);
const SCALE = 12.5091;
const COUNT = 11;

// One value per day, column-major: -1 is a day outside the calendar, 0 an empty
// day, 1 the busiest day of the year.
var<private> levels: array<f32, 371> = array<f32, 371>(
  0.0, 0.0, 0.0, 0.1577, 0.5457, 0.6309, 0.0, 0.0, 0.25, 0.1577, 0.7232, 0.3155, 0.1577, 0.0, 0.0, 0.0, 0.1577, 0.0, 0.0, 0.25, 0.0, 0.0, 0.0, 0.25, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.6005, 0.0, 0.0, 0.0, 0.0, 0.0, 0.25, 0.5, 0.6309, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.5837, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.5837, 0.7135, 0.0, 0.3155, 0.4077, 0.0, 0.3155, 0.1577, 0.1577, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.1577, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.5457, 0.6817, 0.5655, 0.7325, 0.5, 0.4732, 0.0, 0.7887, 0.0, 0.0, 0.3662, 0.4428, 0.524, 0.4732, 0.0, 0.5, 0.0, 0.0, 0.5837, 0.4428, 0.1577, 0.5655, 0.6162, 0.6928, 0.0, 0.0, 0.5655, 0.3662, 0.3662, 0.524, 0.4077, 0.0, 0.1577, 0.0, 0.4428, 0.4428, 0.5457, 0.0, 0.3155, 0.8611, 0.0, 0.0, 0.0, 0.0, 0.3155, 0.5, 0.0, 0.25, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.524, 0.0, 0.25, 0.0, 0.3662, 0.3155, 0.3662, 0.6005, 0.7034, 0.5, 0.524, 0.0, 0.0, 0.0, 0.25, 0.0, 0.0, 0.3155, 0.0, 0.0, 0.1577, 0.0, 0.0, 0.0, 0.25, 0.4077, 0.3155, 0.1577, 0.1577, 0.0, 0.0, 0.0, 0.5655, 0.3662, 0.3662, 0.0, 0.0, 0.0, 0.3155, 0.4077, 0.4428, 0.0, 0.0, 0.25, 0.0, 0.0, 0.0, 0.1577, 0.0, 0.0, 0.0, 0.1577, 0.5837, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.1577, 0.4077, 0.3155, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.1577, 0.0, 0.25, 0.5655, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.4428, 0.0, 0.0, 0.3662, 0.524, 0.3662, 0.3662, 0.0, 0.0, 0.0, 0.0, 0.3155, 0.1577, 0.0, 0.0, 0.0, 0.4732, 0.1577, 0.1577, 0.0, 0.0, 0.0, 0.524, 0.0, 0.5, 0.5, 0.7232, 0.3155, 0.0, 0.0, 0.0, 0.1577, 0.5655, 0.5, 0.4077, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.1577, 0.0, 0.0, 0.0, 0.3155, 0.1577, 0.0, 0.25, 0.1577, 0.6005, 0.4428, 0.5457, 0.67, 0.4077, 0.0, 0.0, 0.25, 0.3662, 0.25, 0.5457, 0.4428, 0.8611, 1.0, 0.8337, 0.9428, 0.9763, 0.8991, 0.9885, 0.8611, 0.4077, 0.7887, 0.0, 0.4428, -1.0, -1.0, -1.0, -1.0, -1.0
);

var<private> glyphHi: array<u32, 11> = array<u32, 11>(
  231490u, 575025u, 508430u, 1020036u, 1020036u, 583347u, 576152u, 476735u, 1001022u, 508430u, 476721u
);
var<private> glyphLo: array<u32, 11> = array<u32, 11>(
  2636u, 17966u, 1086u, 4228u, 4255u, 17969u, 21073u, 17969u, 21073u, 1086u, 17966u
);

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

// Noise pushed through itself twice. The result flows like ink in water instead
// of drifting like a cloud, and every time term is a full turn of a circle, so
// the last frame lands exactly on the first.
fn nebula(p: vec2f, phase: f32) -> f32 {
  let orbit = vec2f(cos(phase), sin(phase));
  let q = vec2f(fbm(p + orbit * 0.20), fbm(p + vec2f(5.2, 1.3) - orbit * 0.16));
  let r = vec2f(
    fbm(p + 2.4 * q + vec2f(1.7, 9.2) + orbit * 0.26),
    fbm(p + 2.4 * q + vec2f(8.3, 2.8) - orbit * 0.22));
  return fbm(p + 2.6 * r);
}

fn palette(t: f32) -> vec3f {
  let a = clamp(t, 0.0, 1.0);
  let deep = mix(vec3f(0.03, 0.05, 0.16), vec3f(0.10, 0.32, 0.78), smoothstep(0.0, 0.45, a));
  let mid = mix(deep, vec3f(0.32, 0.55, 0.98), smoothstep(0.35, 0.68, a));
  let hot = mix(mid, vec3f(0.92, 0.38, 0.85), smoothstep(0.62, 0.86, a));
  return mix(hot, vec3f(1.0, 0.93, 0.85), smoothstep(0.88, 1.0, a));
}

fn glyphBit(index: i32, row: i32, col: i32) -> f32 {
  if (row < 4) {
    return f32((glyphHi[index] >> u32(19 - (row * 5 + col))) & 1u);
  }
  return f32((glyphLo[index] >> u32(14 - ((row - 4) * 5 + col))) & 1u);
}

fn textSample(p: vec2f) -> f32 {
  let local = (p - TEXT) / SCALE;
  if (local.y < 0.0 || local.y >= 7.0) { return 0.0; }
  if (local.x < 0.0 || local.x >= f32(COUNT) * 6.0) { return 0.0; }
  let ci = i32(floor(local.x / 6.0));
  let gx = local.x - f32(ci) * 6.0;
  if (gx >= 5.0) { return 0.0; }
  return glyphBit(ci, i32(local.y), i32(gx));
}

// Four taps to take the stair-steps off a bitmap font scaled up this far.
fn textMask(p: vec2f) -> f32 {
  return 0.25 * (
    textSample(p + vec2f(-0.3, -0.3)) + textSample(p + vec2f(0.3, -0.3)) +
    textSample(p + vec2f(-0.3, 0.3)) + textSample(p + vec2f(0.3, 0.3)));
}

fn textGlow(p: vec2f, radius: f32) -> f32 {
  var sum = 0.0;
  for (var i = 0; i < 12; i++) {
    let a = TAU * f32(i) / 12.0;
    sum += textSample(p + vec2f(cos(a), sin(a)) * radius);
  }
  return sum / 12.0;
}

// The year, kept as texture: a faint constellation of days behind everything
// else. No axes, no labels, nothing to read.
fn constellation(px: vec2f, phase: f32) -> vec3f {
  let g = (px - GRID) / CELL;
  let col = i32(floor(g.x));
  let row = i32(floor(g.y));
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) { return vec3f(0.0); }
  let level = levels[col * ROWS + row];
  if (level < 0.0) { return vec3f(0.0); }

  let local = fract(g) - 0.5;
  let breathe = 0.75 + 0.25 * sin(phase + f32(col) * 0.26 + f32(row) * 0.7);
  let core = exp(-length(local) * (13.0 - 6.0 * level));
  let halo = exp(-length(local) * 3.4) * level;
  let tint = mix(vec3f(0.16, 0.42, 0.72), vec3f(0.95, 0.45, 0.85), level);
  return tint * (core * (0.08 + 0.95 * level) + halo * 0.35) * breathe;
}

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let px = uv * RES;
  let phase = params.time * TAU;
  let p = (px - RES * 0.5) / RES.y;

  // Background: ink in water, lit from inside.
  let n = nebula(p * 2.1 + vec2f(3.0, 1.0), phase);
  let depth = nebula(p * 1.05 - vec2f(2.0, 4.0), phase + 1.7);
  let body = pow(clamp(n * 1.15 - 0.12, 0.0, 1.0), 2.1);
  var fog = palette(0.20 + 0.75 * n) * body * (0.35 + 0.9 * depth);
  fog *= 0.35 + 0.85 * smoothstep(0.85, 0.05, length(p * vec2f(0.60, 1.3)));
  var color = PAGE + fog;

  color += constellation(px, phase);

  // The name is the same field burning hotter, with the fog pushed away from it
  // and a shadow underneath so it sits above the scene rather than in it.
  let mask = textMask(px);
  let glow = textGlow(px, SCALE * 0.55);
  let shadow = textGlow(px - vec2f(0.0, SCALE * 0.34), SCALE * 0.5);
  let inner = nebula(p * 2.2 + vec2f(9.0, 6.0), phase + 0.9);

  color *= 1.0 - 0.55 * clamp(shadow - mask, 0.0, 1.0);
  color += palette(0.55 + 0.45 * inner) * glow * 0.75;

  // Split the mask by channel a fraction of a pixel apart. It is the difference
  // between a flat fill and something that looks like it is emitting light.
  let maskR = textMask(px + vec2f(1.1, 0.0));
  let maskB = textMask(px - vec2f(1.1, 0.0));
  let hot = smoothstep(0.45, 0.95, inner);
  let letter = palette(0.42 + 0.5 * inner) * (0.6 + 1.25 * inner) + vec3f(0.9, 0.95, 1.0) * hot * 0.55;
  color = vec3f(
    mix(color.r, letter.r, maskR),
    mix(color.g, letter.g, mask),
    mix(color.b, letter.b, maskB));

  // A slow specular sweep, off-canvas at both ends of the loop.
  let sweepX = params.time * (RES.x + 900.0) - 450.0;
  let sweep = exp(-abs(px.x - sweepX) / 110.0);
  color += vec3f(0.55, 0.75, 1.0) * sweep * (mask * 0.55 + glow * 0.25 + 0.02);

  // A little static dither. Enough to break banding in the dark corners, small
  // enough that the GIF still compresses.
  // Everything the shader added fades out at the border, so the last row of
  // pixels is the page colour exactly and the image has no visible rectangle.
  let edge = smoothstep(0.0, 0.035, uv.x) * smoothstep(1.0, 0.965, uv.x) *
             smoothstep(0.0, 0.06, uv.y) * smoothstep(1.0, 0.94, uv.y);
  color = PAGE + (color - PAGE) * edge;
  color += (hash21(px) - 0.5) * 0.006;

  return vec4f(clamp(color, vec3f(0.0), vec3f(1.0)), 1.0);
}

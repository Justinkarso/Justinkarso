import { packString, GLYPH_COLS, GLYPH_ROWS, GLYPH_SPLIT_ROW } from "./font.js";

// The banner is regenerated on every build, so the year of contributions and
// the name are compiled into the WGSL as constants. The only uniform is the
// loop phase, which is what keeps the GIF seamless.

const ADVANCE = GLYPH_COLS + 1;
const ROWS = 7;

function f(n) {
  return Number.isInteger(n) ? `${n}.0` : `${Number(n.toFixed(4))}`;
}

export function buildBanner(profile, { width, height }) {
  const title = profile.login.toUpperCase();
  const glyphs = packString(title);

  // The name is set as wide as it can go without crowding the edges, and the
  // grid sits behind it as texture rather than as a chart.
  const scale = Math.min(
    (width * 0.86) / (title.length * ADVANCE),
    (height * 0.34) / GLYPH_ROWS,
  );
  const textWidth = title.length * ADVANCE * scale - scale;
  const textX = (width - textWidth) / 2;
  const textY = (height - GLYPH_ROWS * scale) / 2;

  const cols = profile.grid.length;
  const cell = (width * 0.92) / cols;
  const gridWidth = cell * cols;
  const gridX = (width - gridWidth) / 2;
  const gridY = (height - cell * ROWS) / 2;

  const levels = profile.grid.flat();

  const wgsl = /* wgsl */ `
struct Params { time: f32 };
@group(0) @binding(0) var<uniform> params: Params;

const TAU = 6.2831853;
const RES = vec2f(${f(width)}, ${f(height)});
const COLS = ${cols};
const ROWS = ${ROWS};
const CELL = ${f(cell)};
const GRID = vec2f(${f(gridX)}, ${f(gridY)});
const TEXT = vec2f(${f(textX)}, ${f(textY)});
const SCALE = ${f(scale)};
const COUNT = ${glyphs.length};

// One value per day, column-major: -1 is a day outside the calendar, 0 an empty
// day, 1 the busiest day of the year.
var<private> levels: array<f32, ${levels.length}> = array<f32, ${levels.length}>(
  ${levels.map((v) => f(v)).join(", ")}
);

var<private> glyphHi: array<u32, ${glyphs.length}> = array<u32, ${glyphs.length}>(
  ${glyphs.map((g) => `${g[0]}u`).join(", ")}
);
var<private> glyphLo: array<u32, ${glyphs.length}> = array<u32, ${glyphs.length}>(
  ${glyphs.map((g) => `${g[1]}u`).join(", ")}
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
  if (row < ${GLYPH_SPLIT_ROW}) {
    return f32((glyphHi[index] >> u32(${GLYPH_SPLIT_ROW * GLYPH_COLS - 1} - (row * ${GLYPH_COLS} + col))) & 1u);
  }
  return f32((glyphLo[index] >> u32(${(GLYPH_ROWS - GLYPH_SPLIT_ROW) * GLYPH_COLS - 1} - ((row - ${GLYPH_SPLIT_ROW}) * ${GLYPH_COLS} + col))) & 1u);
}

fn textSample(p: vec2f) -> f32 {
  let local = (p - TEXT) / SCALE;
  if (local.y < 0.0 || local.y >= ${f(GLYPH_ROWS)}) { return 0.0; }
  if (local.x < 0.0 || local.x >= f32(COUNT) * ${f(ADVANCE)}) { return 0.0; }
  let ci = i32(floor(local.x / ${f(ADVANCE)}));
  let gx = local.x - f32(ci) * ${f(ADVANCE)};
  if (gx >= ${f(GLYPH_COLS)}) { return 0.0; }
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
  var color = palette(0.20 + 0.75 * n) * body * (0.35 + 0.9 * depth);
  color += vec3f(0.012, 0.018, 0.05);
  color *= 0.35 + 0.85 * smoothstep(0.85, 0.05, length(p * vec2f(0.60, 1.3)));

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
  color += (hash21(px) - 0.5) * 0.006;

  return vec4f(pow(clamp(color, vec3f(0.0), vec3f(1.0)), vec3f(0.92)), 1.0);
}
`;

  return { wgsl };
}

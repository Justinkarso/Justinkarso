// Everything the pieces share: hashing, noise, the palette, and the loop
// convention that every time term is a full turn of a circle so the last frame
// lands exactly on the first.
export const PRELUDE = /* wgsl */ `
struct Params { time: f32 };
@group(0) @binding(0) var<uniform> params: Params;

const TAU = 6.2831853;

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
`;

function f(n) {
  return Number.isInteger(n) ? `${n}.0` : `${Number(n.toFixed(4))}`;
}

// A hairline that lives where a horizontal rule used to be: a filament of light
// with a charge running along it.
export function buildDivider({ width, height }, seed = 0) {
  return `${PRELUDE}
const RES = vec2f(${f(width)}, ${f(height)});
const SEED = ${f(seed)};

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
  var color = palette(0.35 + 0.6 * energy) * (core * (0.5 + 1.6 * energy) + halo * 0.18 * energy);

  // Fade both ends so the strip has no hard edges against the page.
  color *= smoothstep(0.0, 0.12, uv.x) * smoothstep(1.0, 0.88, uv.x);
  color += (hash21(px) - 0.5) * 0.004;

  return vec4f(pow(clamp(color, vec3f(0.0), vec3f(1.0)), vec3f(0.92)), 1.0);
}
`;
}

// A year of days as a field of light. No axes, no labels, nothing to read: the
// shape of the year is the whole point.
export function buildYear(profile, { width, height }) {
  const cols = profile.grid.length;
  const rows = 7;
  const cell = (width * 0.94) / cols;
  const originX = (width - cell * cols) / 2;
  const originY = (height - cell * rows) / 2;
  const levels = profile.grid.flat();

  return `${PRELUDE}
const RES = vec2f(${f(width)}, ${f(height)});
const COLS = ${cols};
const ROWS = ${rows};
const CELL = ${f(cell)};
const ORIGIN = vec2f(${f(originX)}, ${f(originY)});

// One value per day, column-major: -1 is outside the calendar, 0 an empty day,
// 1 the busiest day of the year.
var<private> levels: array<f32, ${levels.length}> = array<f32, ${levels.length}>(
  ${levels.map((v) => f(v)).join(", ")}
);

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let px = uv * RES;
  let phase = params.time * TAU;
  let p = (px - RES * 0.5) / RES.y;

  let orbit = vec2f(cos(phase), sin(phase));
  let fog = fbm(p * 1.9 + orbit * 0.22 + vec2f(4.0, 2.0));
  var color = palette(0.15 + 0.5 * fog) * pow(fog, 2.4) * 0.55;
  color += vec3f(0.010, 0.014, 0.038);

  let g = (px - ORIGIN) / CELL;
  let col = i32(floor(g.x));
  let row = i32(floor(g.y));

  // A wave crossing the year, lifting each day as it passes.
  let head = params.time * (RES.x + 700.0) - 350.0;
  let wave = exp(-abs(px.x - head) / 120.0);

  if (col >= 0 && col < COLS && row >= 0 && row < ROWS) {
    let level = levels[col * ROWS + row];
    if (level >= 0.0) {
      let local = fract(g) - 0.5;
      let round = length(max(abs(local) * 2.0 - 0.52, vec2f(0.0))) - 0.20;
      let tile = smoothstep(0.20, 0.02, round);

      let breathe = 0.82 + 0.18 * sin(phase + f32(col) * 0.24 + f32(row) * 0.62);
      let lit = level * breathe + wave * (0.25 + 0.75 * level);
      let quiet = vec3f(0.055, 0.075, 0.15) * (1.0 + wave * 2.2);
      let tone = palette(0.30 + 0.62 * lit) * (0.35 + 1.25 * lit);

      color = mix(color, select(tone, quiet, level <= 0.0001), tile);
      color += palette(0.45 + 0.5 * level) * tile * level * level * 0.6;
      color += palette(0.5 + 0.4 * level) * exp(-length(local) * 2.6) * level * 0.20;
    }
  }

  color *= 0.55 + 0.75 * smoothstep(1.05, 0.15, length(p * vec2f(0.55, 1.25)));
  color += (hash21(px) - 0.5) * 0.006;

  return vec4f(pow(clamp(color, vec3f(0.0), vec3f(1.0)), vec3f(0.92)), 1.0);
}
`;
}

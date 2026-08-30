import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { init, effect, target } from "vgpu/node";

import { collect } from "./github.js";
import { buildBanner } from "./shader.js";
import { buildDivider, buildYear } from "./pieces.js";
import { encodeGif } from "./gif.js";
import { imageBlock, injectBlock, readReadme } from "./readme.js";
import { writePreview } from "./preview.js";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}
const flag = (name) => process.argv.includes(`--${name}`);

const login = arg("user", "Justinkarso");
const out = resolve(arg("out", process.cwd()));
const readmePath = resolve(arg("readme", join(out, "README.md")));
const assets = resolve(arg("assets", join(out, "assets")));
const adapter = arg("adapter", process.env.VGPU_ADAPTER);
const only = arg("only", null);

const profile = await collect(login, join(out, ".cache", "github.json"));

// Every piece of art in the README, in one list: what it draws, how big it is,
// and how long its loop runs. The dividers are the same shader with different
// seeds, which is why they drift out of step with each other on the page.
const pieces = [
  {
    name: "banner",
    alt: profile.login,
    size: [960, 288],
    frames: 24,
    fps: 15,
    colors: 96,
    wgsl: buildBanner(profile, { width: 960, height: 288 }).wgsl,
  },
  {
    name: "year",
    alt: "a year of commits",
    size: [960, 150],
    frames: 24,
    fps: 15,
    colors: 96,
    wgsl: buildYear(profile, { width: 960, height: 150 }),
  },
  ...[0, 1, 2, 3].map((i) => ({
    name: `rule-${i + 1}`,
    alt: "",
    size: [960, 18],
    frames: 20,
    fps: 20,
    colors: 48,
    wgsl: buildDivider({ width: 960, height: 18 }, i * 7.3),
  })),
];

const gpu = await init(adapter ? { adapter } : undefined);
try {
  let markdown = readReadme(readmePath);

  for (const piece of pieces) {
    if (only && piece.name !== only) continue;
    const [width, height] = piece.size;
    const canvas = target(gpu, { size: [width, height] });
    const shader = effect(gpu, piece.wgsl, { label: piece.name, set: { params: { time: 0 } } });

    const frames = [];
    for (let i = 0; i < piece.frames; i++) {
      shader.set({ params: { time: i / piece.frames } });
      shader.draw(canvas);
      frames.push(await canvas.read());
    }

    const gif = encodeGif(frames, width, height, piece.fps, piece.colors);
    const file = join(assets, `${piece.name}.gif`);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, gif);
    // The generated shader is half the point, so it ships next to the art.
    writeFileSync(join(assets, `${piece.name}.wgsl`), piece.wgsl);

    const rel = relative(dirname(readmePath), file).split("\\").join("/");
    markdown = injectBlock(markdown, piece.name, imageBlock(piece.name, rel, piece.alt, width));

    console.log(`${piece.name.padEnd(8)} ${piece.frames} frames, ${(gif.length / 1024).toFixed(0)} KB`);
  }

  writeFileSync(readmePath, markdown);
  console.log(`readme   ${readmePath}`);
  if (flag("preview")) {
    console.log(`preview  ${writePreview(readmePath, markdown, join(out, "preview"))}`);
  }
} finally {
  gpu.dispose();
}

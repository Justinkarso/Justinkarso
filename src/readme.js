import { readFileSync, existsSync } from "node:fs";

const marker = (name, edge) => `<!-- vgpu:${name}:${edge} -->`;

export function imageBlock(name, path, alt, width) {
  return [
    marker(name, "start"),
    `<p align="center"><img src="${path}" alt="${alt}" width="${width}"></p>`,
    marker(name, "end"),
  ].join("\n");
}

// Replaces what sits between a piece's markers and leaves everything else, so
// the hand-written half of the README is never touched by a render.
export function injectBlock(markdown, name, block) {
  const start = markdown.indexOf(marker(name, "start"));
  const end = markdown.indexOf(marker(name, "end"));
  if (start === -1 || end === -1) return markdown;
  return markdown.slice(0, start) + block + markdown.slice(end + marker(name, "end").length);
}

export function readReadme(path) {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

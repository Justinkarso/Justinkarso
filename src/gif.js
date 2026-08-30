import gifenc from "gifenc";

const { GIFEncoder, quantize, applyPalette } = gifenc;

// Pixels that barely move between frames are written as transparent, so the
// encoder repeats the previous frame there instead of storing it again. On a
// banner whose background drifts slowly this is the difference between a
// two megabyte GIF and a few hundred kilobytes.
const TOLERANCE = 26;

export function encodeGif(frames, width, height, fps, colors = 128) {
  const pixels = width * height;
  const sampleStride = Math.max(1, Math.floor(frames.length / 8));
  const sampleSize = pixels * 4;
  const samples = new Uint8Array(sampleSize * Math.ceil(frames.length / sampleStride));
  let offset = 0;
  for (let i = 0; i < frames.length; i += sampleStride) {
    samples.set(frames[i], offset);
    offset += sampleSize;
  }

  // One palette for the whole loop. Per-frame palettes are slightly sharper but
  // they make the animation shimmer, which is worse than a little banding.
  const palette = quantize(samples.subarray(0, offset), colors - 1, { format: "rgb565" });
  const transparentIndex = palette.length;
  palette.push([0, 0, 0]);

  const encoder = GIFEncoder();
  const delay = Math.round(1000 / fps);
  // What the viewer is currently looking at. Comparing against this rather than
  // against the previous frame stops slow drift from freezing: a pixel that
  // creeps below the tolerance every frame still gets rewritten once the total
  // distance from what is on screen grows past it.
  let displayed = null;
  let first = true;

  for (const frame of frames) {
    const indexed = applyPalette(frame, palette, "rgb565");
    if (displayed) {
      for (let p = 0; p < pixels; p++) {
        const i = p * 4;
        const diff =
          Math.abs(frame[i] - displayed[i]) +
          Math.abs(frame[i + 1] - displayed[i + 1]) +
          Math.abs(frame[i + 2] - displayed[i + 2]);
        if (diff <= TOLERANCE) {
          indexed[p] = transparentIndex;
        } else {
          displayed[i] = frame[i];
          displayed[i + 1] = frame[i + 1];
          displayed[i + 2] = frame[i + 2];
        }
      }
    } else {
      displayed = Uint8Array.from(frame);
    }
    encoder.writeFrame(indexed, width, height, {
      palette,
      delay,
      transparent: !first,
      transparentIndex,
      dispose: 1,
    });
    first = false;
  }

  encoder.finish();
  return Buffer.from(encoder.bytes());
}

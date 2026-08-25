import { GRAIN_ALPHA } from "../constants";

/**
 * Paper grain: one noise tile, generated once, tiled forever.
 *
 * Generating it per frame is the obvious thing and it is wrong — animated
 * noise reads as video static or a dirty screen, not as paper. Paper grain
 * does not move. Generate once, cache, and honour
 * `prefers-reduced-motion` only insofar as everything else stops moving;
 * the grain is static either way.
 */
export function createGrainTile(size: number): CanvasPattern | null {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const image = ctx.createImageData(size, size);
  for (let i = 0; i < image.data.length; i += 4) {
    const v = Math.floor(Math.random() * 256);
    image.data[i] = v;
    image.data[i + 1] = v;
    image.data[i + 2] = v;
    image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);

  return ctx.createPattern(canvas, "repeat");
}

export function paintGrain(ctx: CanvasRenderingContext2D, pattern: CanvasPattern): void {
  ctx.save();
  ctx.globalAlpha = GRAIN_ALPHA;
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
}

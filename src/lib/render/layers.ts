import type { InkChannel } from "../constants";

/**
 * Three offscreen ink layers, composited onto paper with `multiply` and a
 * small registration offset. This is the signature (plan.md §2.5): the
 * print is always slightly out of register, and on a collision it jolts.
 *
 * Why offscreen layers rather than drawing each cell three times directly:
 * real printing offsets a whole PLATE, not individual marks. Per-cell
 * offsets look like a chromatic-aberration filter; per-layer offsets look
 * like a misregistered print. It is also fewer state changes — three
 * composites a frame instead of six hundred.
 */
export type InkLayers = {
  /** Draw into one channel. The callback gets a context already set up
   *  with the right composite mode and the channel's flat ink colour. */
  paint(channel: InkChannel, draw: (ctx: CanvasRenderingContext2D) => void): void;
  /** Clear all three layers. Once per frame, before painting. */
  clear(): void;
  /**
   * Composite the three layers onto the visible canvas over paper stock.
   * `jolt` is 0..1 and scales the registration offsets by
   * `1 + jolt * JOLT_SCALE`.
   */
  composite(target: CanvasRenderingContext2D, jolt: number): void;
  resize(width: number, height: number, dpr: number): void;
  /** True when the FPS fallback has collapsed to single-layer drawing. */
  readonly degraded: boolean;
  /** Called by the loop with the frame time; may flip `degraded`. */
  sample(frameMs: number): void;
};

export function createLayers(_width: number, _height: number, _dpr: number): InkLayers {
  throw new Error("not implemented — see plan.md Issue 5");
}

/**
 * Decaying jolt accumulator. Collisions add energy; it falls off over
 * JOLT_DECAY_MS. Shared so the loop can feed it every collision event and
 * read one number.
 */
export function createJolt(): {
  add(energy: number): void;
  /** Advance and read, 0..1. */
  tick(dtMs: number): number;
} {
  throw new Error("not implemented — see plan.md Issue 5");
}

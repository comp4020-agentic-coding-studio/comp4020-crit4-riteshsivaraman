import type { Organism } from "../sim";
import type { InkLayers } from "./layers";

/**
 * Draw the population into the ink layers.
 *
 * A cell is a filled disc with a slightly denser nucleus at 45% radius and
 * a subtle pulse whose rate comes from `genome.speed`. It is NOT a glowing
 * orb — no shadowBlur, no radial gradient bloom. Ink does not glow, and
 * the moment one cell glows the whole print stops reading as a print.
 *
 * Alpha is capped at CELL_ALPHA so a dense clump multiplies toward a deep
 * overprint rather than straight to black. Density showing as darkness is
 * correct and wanted; density showing as a black hole is not.
 */
export function drawPopulation(
  _layers: InkLayers,
  _organisms: readonly Organism[],
  _timeMs: number,
): void {
  throw new Error("not implemented — see plan.md Issue 5");
}

/**
 * The charging nucleus: a growing disc with the accumulated offspring
 * orbiting it. Drawn on top of the population, in the ink of the degree
 * currently under the pointer, so the player can see the pitch they are
 * about to release.
 */
export function drawCharge(
  _layers: InkLayers,
  _charge: { x: number; y: number; fullness: number; count: number; degree: number },
  _timeMs: number,
): void {
  throw new Error("not implemented — see plan.md Issue 5");
}

/** Fade and shrink over the last FADE_SECONDS of life. */
export const FADE_SECONDS = 1.2;

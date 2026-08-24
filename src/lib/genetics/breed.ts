import { DEGREE_MUTATION_P } from "../constants";
import type { Genome, Rng } from "./genome";

/**
 * Box–Muller. Gaussian nudges beat uniform ones here because most children
 * should resemble their parent closely and only occasionally jump — that
 * shape is what makes a lineage feel like drift rather than noise.
 *
 * Reference implementation: correct as written, don't rewrite it.
 */
export function gaussian(rng: Rng): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * One child from one parent.
 *
 * - continuous fields: `field += gaussian() * drift * MUTATION_SCALE`
 * - `degree`: with probability DEGREE_MUTATION_P, step by ±1 (or rarely ±2).
 *   **Whole steps only.** A fractional degree is invariant I4's failure
 *   mode and it is the only way this instrument can produce a wrong note.
 * - finish by returning `clampGenome(child)` — one enforcement point.
 *
 * `drift` is the DRIFT control, 0..1. At 0 the child is an exact copy: the
 * player has turned evolution off, which is a legitimate way to play.
 */
export function breed(_parent: Genome, _drift: number, _rng: Rng): Genome {
  throw new Error("not implemented — see plan.md Issue 1");
}

/** How far one standard deviation of drift moves a continuous field. */
export const MUTATION_SCALE = 0.12;

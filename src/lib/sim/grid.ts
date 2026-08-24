import { GRID_CELL } from "../constants";
import type { Organism } from "./types";

/**
 * Uniform spatial hash for broad-phase collision.
 *
 * At 220 organisms, all-pairs is 24 090 checks per substep and 4 substeps
 * per frame — that is the difference between 60fps and a slideshow on a
 * phone, so this is not premature.
 *
 * The contract that matters: `forEachPair` must yield each unordered pair
 * **at most once**. A cell straddling a grid boundary appears in several
 * buckets, so the naive version emits some pairs two or three times, which
 * doubles their impulse and re-triggers their sound. Deduplicate by
 * ordering on `id` and tracking what has been yielded this step.
 */
export class SpatialGrid {
  private readonly buckets = new Map<number, Organism[]>();
  private cols = 0;

  constructor(public readonly cellSize: number = GRID_CELL) {}

  /** Clear and refill from the current population. Called once per substep. */
  rebuild(_organisms: readonly Organism[], _width: number, _height: number): void {
    throw new Error("not implemented — see plan.md Issue 3");
  }

  /**
   * Yield every candidate pair exactly once. Callers still do the precise
   * circle test; this only narrows the field.
   */
  forEachPair(_visit: (a: Organism, b: Organism) => void): void {
    throw new Error("not implemented — see plan.md Issue 3");
  }
}

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
  private rows = 0;

  constructor(public readonly cellSize: number = GRID_CELL) {}

  private cellKey(cx: number, cy: number): number {
    return cy * this.cols + cx;
  }

  /** Clear and refill from the current population. Called once per substep. */
  rebuild(organisms: readonly Organism[], width: number, height: number): void {
    this.buckets.clear();
    this.cols = Math.max(1, Math.ceil(width / this.cellSize));
    this.rows = Math.max(1, Math.ceil(height / this.cellSize));

    for (const o of organisms) {
      // An organism's bounding box can straddle several cells (cell size is
      // sized so it can't span more than a 2x2 neighbourhood) — insert it
      // into every cell it overlaps, or a pair split across a boundary
      // would be missed entirely rather than merely double-counted.
      const minCx = this.clampCol(Math.floor((o.x - o.radius) / this.cellSize));
      const maxCx = this.clampCol(Math.floor((o.x + o.radius) / this.cellSize));
      const minCy = this.clampRow(Math.floor((o.y - o.radius) / this.cellSize));
      const maxCy = this.clampRow(Math.floor((o.y + o.radius) / this.cellSize));

      for (let cy = minCy; cy <= maxCy; cy++) {
        for (let cx = minCx; cx <= maxCx; cx++) {
          const key = this.cellKey(cx, cy);
          let bucket = this.buckets.get(key);
          if (!bucket) {
            bucket = [];
            this.buckets.set(key, bucket);
          }
          bucket.push(o);
        }
      }
    }
  }

  private clampCol(cx: number): number {
    return Math.min(this.cols - 1, Math.max(0, cx));
  }

  private clampRow(cy: number): number {
    return Math.min(this.rows - 1, Math.max(0, cy));
  }

  /**
   * Yield every candidate pair exactly once. Callers still do the precise
   * circle test; this only narrows the field.
   */
  forEachPair(visit: (a: Organism, b: Organism) => void): void {
    const seen = new Set<string>();
    for (const bucket of this.buckets.values()) {
      for (let i = 0; i < bucket.length; i++) {
        for (let j = i + 1; j < bucket.length; j++) {
          const a = bucket[i];
          const b = bucket[j];
          const key = a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`;
          if (seen.has(key)) continue;
          seen.add(key);
          visit(a, b);
        }
      }
    }
  }
}

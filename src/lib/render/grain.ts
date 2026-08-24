/**
 * Paper grain: one noise tile, generated once, tiled forever.
 *
 * Generating it per frame is the obvious thing and it is wrong — animated
 * noise reads as video static or a dirty screen, not as paper. Paper grain
 * does not move. Generate once, cache, and honour
 * `prefers-reduced-motion` only insofar as everything else stops moving;
 * the grain is static either way.
 */
export function createGrainTile(_size: number): CanvasPattern | null {
  throw new Error("not implemented — see plan.md Issue 5");
}

export function paintGrain(_ctx: CanvasRenderingContext2D, _pattern: CanvasPattern): void {
  throw new Error("not implemented — see plan.md Issue 5");
}

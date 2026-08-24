import { SCALE_SPAN } from "../audio/scales";
import type { InkChannel } from "../constants";
import type { Genome } from "./genome";

export type Ink = Readonly<Record<InkChannel, number>>;

/**
 * Genome → ink weights, each 0..1.
 *
 * Colour is DERIVED, never stored on the organism (invariant I7). That is
 * what makes family resemblance automatic: a child that mutated its pitch
 * looks different by exactly as much as it sounds different, because both
 * are reading the same field.
 *
 *   pink   ← degree      high notes are pink
 *   blue   ← size        big, heavy cells are blue
 *   yellow ← brightness  bright timbre is yellow
 *
 * The three inks multiply on paper, so a child whose genome sits between
 * two parents prints as the overprint of their two colours. The visual
 * metaphor and the mechanism are the same thing; keep it that way.
 *
 * Must be pure and referentially transparent — the render layer may cache
 * on genome identity.
 */
export function inkOf(g: Genome): Ink {
  return {
    pink: g.degree / (SCALE_SPAN - 1),
    blue: g.size,
    yellow: g.brightness,
  };
}

/** Longest wavelength first, so the composite order is stable. */
export const INK_ORDER = ["yellow", "pink", "blue"] as const;

export { SCALE_SPAN };

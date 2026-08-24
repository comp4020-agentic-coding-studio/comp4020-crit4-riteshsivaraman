import { SCALE_SPAN } from "../audio/scales";

/**
 * An organism's heritable state.
 *
 * Seven fields, and every one of them drives BOTH a physical and a musical
 * property — that coupling is the thing the player learns by playing, so
 * do not add a field that only affects one side.
 *
 * `degree` is an integer index into the active scale, never a frequency.
 * That is invariant I4/I3 and it is what makes "there is no way to play it
 * wrong" true by construction: no mutation can land between two notes,
 * because there is nothing between two indices.
 */
export type Genome = {
  /** Integer, 0..SCALE_SPAN-1. Index into the mood's scale across octaves. */
  degree: number;
  /** 0..1 → radius, mass, loudness. */
  size: number;
  /** 0..1 → restitution. */
  bounce: number;
  /** 0..1 → initial energy, visual pulse rate. */
  speed: number;
  /** 0..1 → filter cutoff, harmonic mix, yellow ink. */
  brightness: number;
  /** 0..1 → note release length. */
  decay: number;
  /** 0..1 → seconds alive, via LIFESPAN_RANGE. */
  lifespan: number;
};

/** The continuous fields. `degree` is deliberately absent — it is integral
 *  and is mutated by whole steps, so it is never clamped as a float. */
export const CONTINUOUS_FIELDS = [
  "size",
  "bounce",
  "speed",
  "brightness",
  "decay",
  "lifespan",
] as const satisfies readonly (keyof Genome)[];

export type ContinuousField = (typeof CONTINUOUS_FIELDS)[number];

/**
 * Per-field bounds. Continuous fields are deliberately NOT all 0..1: an
 * organism with size 0 is invisible and silent, which reads as a bug.
 */
export const GENOME_BOUNDS: Readonly<Record<ContinuousField, readonly [number, number]>> = {
  size: [0.12, 1],
  bounce: [0.1, 1],
  speed: [0.08, 1],
  brightness: [0, 1],
  decay: [0.05, 1],
  lifespan: [0.15, 1],
};

export const DEGREE_BOUNDS: readonly [number, number] = [0, SCALE_SPAN - 1];

/** A seedable random source, so the fuzz tests are reproducible. */
export type Rng = () => number;

/**
 * Force a genome into bounds and integrality. Idempotent, total: after
 * `clampGenome`, invariant I4 holds regardless of what produced the input.
 *
 * Exported so tests can fuzz it directly, and so `breed` has exactly one
 * place that enforces bounds rather than clamping field by field.
 */
export function clampGenome(_g: Genome): Genome {
  throw new Error("not implemented — see plan.md Issue 1");
}

/** Uniform within GENOME_BOUNDS, `degree` uniform over DEGREE_BOUNDS. */
export function randomGenome(_rng: Rng): Genome {
  throw new Error("not implemented — see plan.md Issue 1");
}

/**
 * A genome from a tap: pitch comes from the gesture, everything else is
 * random. `yNorm` is 0 at the TOP of the canvas, so it inverts — higher on
 * screen is a higher note, which is the one mapping the invite line
 * promises ("higher is higher").
 */
export function genomeFromGesture(_xNorm: number, _yNorm: number, _rng: Rng): Genome {
  throw new Error("not implemented — see plan.md Issue 1");
}

/** Map yNorm (0 = top) to a scale degree. Shared by pointer and tests. */
export function degreeFromY(_yNorm: number): number {
  throw new Error("not implemented — see plan.md Issue 1");
}

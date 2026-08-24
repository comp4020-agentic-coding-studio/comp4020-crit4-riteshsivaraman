/**
 * The only module in the codebase permitted to compute a frequency.
 *
 * Everything upstream — gestures, genomes, mutation, collisions — speaks in
 * integer scale degrees. Hz appears here, at the last step, and nowhere
 * else. That is invariant I3, and it is how spec line 6 ("there is no way
 * to play it wrong") is satisfied by construction rather than by vigilance.
 *
 * If you find yourself writing `440 *` or `Math.pow(2, ...)` in another
 * file, that is the bug.
 */

export type Mood = "bright" | "deep" | "open";

export type ScaleDef = {
  /** MIDI note of degree 0. */
  root: number;
  /** Semitone offsets within one octave. */
  steps: readonly number[];
  /** What the player sees. Moods, not theory. */
  label: string;
};

export const MOODS: Readonly<Record<Mood, ScaleDef>> = {
  bright: { root: 60, steps: [0, 2, 4, 7, 9], label: "bright" }, // C major pentatonic
  deep: { root: 45, steps: [0, 3, 5, 7, 10], label: "deep" }, //    A minor pentatonic, low
  open: { root: 50, steps: [0, 2, 5, 7, 9], label: "open" }, //     D suspended
};

export const MOOD_ORDER = ["bright", "deep", "open"] as const satisfies readonly Mood[];

/** Degrees span three octaves. All moods have 5 steps, so 15 degrees. */
export const OCTAVES = 3;
export const SCALE_SPAN = 5 * OCTAVES;

/**
 * degree → Hz.
 *
 *   octave = floor(degree / steps.length)
 *   midi   = root + 12 * octave + steps[degree % steps.length]
 *   hz     = 440 * 2 ** ((midi - 69) / 12)
 *
 * Must clamp `degree` into [0, SCALE_SPAN-1] rather than throwing: a
 * clamped note is musical, an exception is silence, and silence in an
 * instrument reads as broken.
 */
export function freq(_degree: number, _mood: Mood): number {
  throw new Error("not implemented — see plan.md Issue 2");
}

/** Every frequency the mood can produce. Used by invariant test I3. */
export function allFrequencies(_mood: Mood): number[] {
  throw new Error("not implemented — see plan.md Issue 2");
}

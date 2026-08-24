import type { Genome, Rng } from "../genetics";
import type { Organism, SpawnOptions, StepResult } from "./types";

/**
 * The simulation.
 *
 * Hard rules:
 *  - `world` never imports from `audio`, `render` or `interaction`. It
 *    returns a StepResult; the caller turns that into sound and pixels.
 *  - `step` is deterministic given the same `rng`. That is what makes the
 *    invariant tests able to run 60 simulated seconds in milliseconds.
 */
export type World = {
  readonly organisms: readonly Organism[];
  readonly width: number;
  readonly height: number;

  resize(width: number, height: number): void;

  /**
   * Add an organism. Returns null if at MAX_POPULATION — spawning must
   * fail closed rather than cull, because the player's own tap being
   * silently eaten to make room for an ambient cell is backwards.
   */
  spawn(genome: Genome, x: number, y: number, options?: SpawnOptions): Organism | null;

  /**
   * Advance by `dt` real seconds using a fixed-timestep accumulator
   * (FIXED_DT, at most MAX_SUBSTEPS per call — a long frame must not
   * produce a longer frame).
   *
   * `now` is a ms timestamp used for the collision and breeding cooldowns;
   * it is passed in rather than read from `performance.now()` so tests can
   * drive time directly.
   */
  step(dt: number, now: number): StepResult;

  /** Fade everything out. The `clear` control. Not a reset — no state to
   *  fail back from, so this only empties the plate. */
  clear(): void;

  /** The DRIFT control, 0..1. At 0, children are exact copies. */
  setDrift(drift: number): void;
  readonly drift: number;
};

export type WorldOptions = {
  width: number;
  height: number;
  rng?: Rng;
  drift?: number;
};

export function createWorld(_options: WorldOptions): World {
  throw new Error("not implemented — see plan.md Issue 3");
}

import type { Genome } from "../genetics";

/**
 * A living cell. Physical state plus the genome that produced it.
 *
 * NOTE what is absent: no colour, no audio node, no DOM reference. Colour
 * is derived (genetics/ink), sound is emitted by the caller from events.
 * Keeping those out is what lets the whole simulation run headless in a
 * test, which is the only reason the population and cooldown invariants
 * are cheap enough to assert.
 */
export type Organism = {
  readonly id: number;
  readonly genome: Genome;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Derived from genome.size via RADIUS_RANGE. Cached: it's read per pair. */
  readonly radius: number;
  /** Proportional to radius². Big cells shove small ones. */
  readonly mass: number;
  /** Derived from genome.bounce via RESTITUTION_RANGE. */
  readonly restitution: number;
  /** Seconds remaining. Counts down; <= 0 is a DeathEvent. */
  life: number;
  /** Total seconds this organism was born with — render reads both to fade. */
  readonly maxLife: number;
  /** ms timestamp of the last collision EVENT (not the last collision). */
  lastSoundAt: number;
  /** ms timestamp of the last birth this organism parented. */
  lastBredAt: number;
  /** Seconds since spawn. Drives the visual pulse. */
  age: number;
};

export type CollisionEvent = {
  a: Organism;
  b: Organism;
  /** Relative approach speed at contact, px/s. */
  speed: number;
  /** Contact point, for the flash and the registration jolt. */
  x: number;
  y: number;
  /** speed / MAX_EVENT_SPEED, clamped 0..1. Drives level and jolt size. */
  energy: number;
};

export type BirthEvent = { child: Organism; parent: Organism };
export type DeathEvent = { organism: Organism };

/**
 * Everything one step produced. The simulation NEVER calls into audio or
 * render; it returns this and the caller decides what to do with it. See
 * the dependency rule in plan.md §3.
 */
export type StepResult = {
  collisions: CollisionEvent[];
  births: BirthEvent[];
  deaths: DeathEvent[];
};

export type SpawnOptions = {
  vx?: number;
  vy?: number;
};

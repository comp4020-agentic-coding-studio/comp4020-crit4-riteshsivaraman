import {
  AMBIENT_IMPULSE,
  AMBIENT_SLEEP_SPEED,
  BREED_CHANCE,
  BREED_COOLDOWN_MS,
  BREED_MIN_ENERGY,
  COLLISION_COOLDOWN_MS,
  CULL_TARGET,
  DRIFT_DEFAULT,
  FIXED_DT,
  LIFESPAN_RANGE,
  MAX_EVENT_SPEED,
  MAX_POPULATION,
  MAX_SUBSTEPS,
  MIN_COLLISION_SPEED,
} from "../constants";
import { breed, type Genome, type Rng } from "../genetics";
import { SpatialGrid } from "./grid";
import { bounceWalls, integrate, massOf, radiusOf, resolvePair, restitutionOf } from "./physics";
import type {
  BirthEvent,
  CollisionEvent,
  DeathEvent,
  Organism,
  SpawnOptions,
  StepResult,
} from "./types";

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

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

class WorldImpl implements World {
  private organismList: Organism[] = [];
  private nextId = 1;
  private accumulator = 0;
  private readonly rng: Rng;
  private readonly grid = new SpatialGrid();
  private driftValue: number;

  width: number;
  height: number;

  constructor(options: WorldOptions) {
    this.width = options.width;
    this.height = options.height;
    this.rng = options.rng ?? Math.random;
    this.driftValue = options.drift ?? DRIFT_DEFAULT;
  }

  get organisms(): readonly Organism[] {
    return this.organismList;
  }

  get drift(): number {
    return this.driftValue;
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  setDrift(drift: number): void {
    this.driftValue = drift;
  }

  spawn(genome: Genome, x: number, y: number, options?: SpawnOptions): Organism | null {
    if (this.organismList.length >= MAX_POPULATION) return null;
    const organism = this.createOrganism(genome, x, y, options?.vx ?? 0, options?.vy ?? 0);
    this.organismList.push(organism);
    return organism;
  }

  clear(): void {
    this.organismList = [];
    this.accumulator = 0;
  }

  step(dt: number, now: number): StepResult {
    const collisions: CollisionEvent[] = [];
    const births: BirthEvent[] = [];
    const deaths: DeathEvent[] = [];

    // A long frame must not produce a longer frame: cap how much simulated
    // time one call can owe, rather than letting the accumulator grow
    // without bound while substeps can never catch up.
    const maxAccumulator = FIXED_DT * MAX_SUBSTEPS;
    this.accumulator = Math.min(this.accumulator + dt, maxAccumulator);

    let substeps = 0;
    while (this.accumulator >= FIXED_DT && substeps < MAX_SUBSTEPS) {
      this.accumulator -= FIXED_DT;
      this.substep(FIXED_DT, now, collisions, births, deaths);
      substeps++;
    }

    return { collisions, births, deaths };
  }

  private createOrganism(genome: Genome, x: number, y: number, vx: number, vy: number): Organism {
    const radius = radiusOf(genome.size);
    const maxLife = lerp(LIFESPAN_RANGE[0], LIFESPAN_RANGE[1], genome.lifespan);
    return {
      id: this.nextId++,
      genome,
      x,
      y,
      vx,
      vy,
      radius,
      mass: massOf(radius),
      restitution: restitutionOf(genome.bounce),
      life: maxLife,
      maxLife,
      lastSoundAt: -Infinity,
      lastBredAt: -Infinity,
      age: 0,
      held: false,
    };
  }

  private substep(
    dt: number,
    now: number,
    collisions: CollisionEvent[],
    births: BirthEvent[],
    deaths: DeathEvent[],
  ): void {
    for (const o of this.organismList) {
      if (!o.held && Math.hypot(o.vx, o.vy) < AMBIENT_SLEEP_SPEED) {
        const angle = this.rng() * Math.PI * 2;
        o.vx += Math.cos(angle) * AMBIENT_IMPULSE;
        o.vy += Math.sin(angle) * AMBIENT_IMPULSE;
      }
      integrate(o, dt);
      bounceWalls(o, this.width, this.height);
    }

    this.grid.rebuild(this.organismList, this.width, this.height);
    this.grid.forEachPair((a, b) => {
      const contact = resolvePair(a, b);
      if (!contact) return;

      if (contact.speed >= MIN_COLLISION_SPEED) {
        const aReady = now - a.lastSoundAt >= COLLISION_COOLDOWN_MS;
        const bReady = now - b.lastSoundAt >= COLLISION_COOLDOWN_MS;
        // Both sides of the pair must be off cooldown, or the organism
        // still gated would receive a second event inside its own window.
        if (aReady && bReady) {
          const energy = Math.min(1, contact.speed / MAX_EVENT_SPEED);
          const voice =
            a.radius < b.radius ? a : b.radius < a.radius ? b : a.id < b.id ? a : b;
          collisions.push({ a, b, voice, speed: contact.speed, x: contact.x, y: contact.y, energy });
          a.lastSoundAt = now;
          b.lastSoundAt = now;
        }
      }

      this.maybeBreed(a, b, contact.speed, now, births);
    });

    for (let i = this.organismList.length - 1; i >= 0; i--) {
      const o = this.organismList[i];
      if (o.life <= 0) {
        deaths.push({ organism: o });
        this.organismList.splice(i, 1);
      }
    }

    if (this.organismList.length > MAX_POPULATION) {
      // Hysteresis: cull down to CULL_TARGET, not back to the cap, so we
      // don't cull one organism per frame forever at the boundary. Oldest
      // (largest `age`) goes first.
      this.organismList.sort((x, y) => x.age - y.age);
      this.organismList.length = CULL_TARGET;
    }
  }

  private maybeBreed(a: Organism, b: Organism, speed: number, now: number, births: BirthEvent[]): void {
    if (this.organismList.length >= MAX_POPULATION) return;

    const energy = Math.min(1, speed / MAX_EVENT_SPEED);
    if (energy < BREED_MIN_ENERGY) return;
    if (this.rng() >= BREED_CHANCE) return;

    const parent = this.rng() < 0.5 ? a : b;
    const partner = parent === a ? b : a;
    if (now - parent.lastBredAt < BREED_COOLDOWN_MS) return;

    const childGenome = breed(parent.genome, this.driftValue, this.rng);
    const childRadius = radiusOf(childGenome.size);

    // Spawn clear of both parent and partner, outward along the axis away
    // from the partner — the contact point itself sits inside both circles
    // and would overlap a parent again on the very next substep.
    const dx = parent.x - partner.x;
    const dy = parent.y - partner.y;
    const dist = Math.hypot(dx, dy);
    const [nx, ny] = dist < 1e-6 ? [1, 0] : [dx / dist, dy / dist];
    const margin = 2;
    const offset = parent.radius + childRadius + margin;

    const child = this.createOrganism(
      childGenome,
      parent.x + nx * offset,
      parent.y + ny * offset,
      parent.vx,
      parent.vy,
    );
    this.organismList.push(child);
    parent.lastBredAt = now;
    births.push({ child, parent });
  }
}

export function createWorld(options: WorldOptions): World {
  return new WorldImpl(options);
}

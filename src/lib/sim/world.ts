import {
  AMBIENT_SLEEP_SPEED,
  BOUNCE_RESTITUTION_SCALE_RANGE,
  BOUNCE_WALL_RANGE,
  BREED_MIN_ENERGY,
  CHATTER_COOLDOWN_RANGE,
  CHATTER_SPEED_RANGE,
  CULL_TARGET,
  DRIFT_DEFAULT,
  FERTILITY_CHANCE_RANGE,
  FERTILITY_COOLDOWN_RANGE,
  FIXED_DT,
  LIFESPAN_RANGE,
  MAX_EVENT_SPEED,
  MAX_POPULATION,
  MAX_SUBSTEPS,
  PARAM_DEFAULTS,
  VIGOUR_BIRTH_RANGE,
  VIGOUR_IMPULSE_RANGE,
  VISCOSITY_DRAG_RANGE,
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
 * The five 0..1 "culture condition" knobs (Issue 13). `world.ts` is the
 * only place that maps a knob onto its real range — the constants stay the
 * single source of truth for the *shape* of each range, `PARAM_DEFAULTS`
 * for the knob position that reproduces today's behaviour exactly.
 *
 *  - `fertility` → BREED_CHANCE, BREED_COOLDOWN_MS
 *  - `vigour`    → AMBIENT_IMPULSE, newborn velocity scale
 *  - `viscosity` → DRAG
 *  - `bounce`    → WALL_RESTITUTION, restitutionOf's scale
 *  - `chatter`   → MIN_COLLISION_SPEED, COLLISION_COOLDOWN_MS
 *
 * BREED_MIN_ENERGY is deliberately not on this list and fertility must
 * never touch it — that gate is what stops idle drift from breeding.
 */
export type WorldParams = {
  /** 0..1 knobs. 0.5 is not the default — see PARAM_DEFAULTS. */
  fertility: number;
  vigour: number;
  viscosity: number;
  bounce: number;
  chatter: number;
};

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

  /** The five culture-condition knobs. Read-only snapshot — go through
   *  `setParam` to change one. */
  readonly params: Readonly<WorldParams>;
  setParam(name: keyof WorldParams, value: number): void;
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
  private paramValues: WorldParams;

  width: number;
  height: number;

  constructor(options: WorldOptions) {
    this.width = options.width;
    this.height = options.height;
    this.rng = options.rng ?? Math.random;
    this.driftValue = options.drift ?? DRIFT_DEFAULT;
    this.paramValues = { ...PARAM_DEFAULTS };
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

  get params(): Readonly<WorldParams> {
    return this.paramValues;
  }

  setParam(name: keyof WorldParams, value: number): void {
    this.paramValues = { ...this.paramValues, [name]: value };
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
    const restitutionScale = lerp(
      BOUNCE_RESTITUTION_SCALE_RANGE[0],
      BOUNCE_RESTITUTION_SCALE_RANGE[1],
      this.paramValues.bounce,
    );
    return {
      id: this.nextId++,
      genome,
      x,
      y,
      vx,
      vy,
      radius,
      mass: massOf(radius),
      restitution: restitutionOf(genome.bounce, restitutionScale),
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
    const { fertility, vigour, viscosity, bounce, chatter } = this.paramValues;
    const drag = lerp(VISCOSITY_DRAG_RANGE[0], VISCOSITY_DRAG_RANGE[1], viscosity);
    const wallRestitution = lerp(BOUNCE_WALL_RANGE[0], BOUNCE_WALL_RANGE[1], bounce);
    const ambientImpulse = lerp(VIGOUR_IMPULSE_RANGE[0], VIGOUR_IMPULSE_RANGE[1], vigour);
    const minCollisionSpeed = lerp(CHATTER_SPEED_RANGE[0], CHATTER_SPEED_RANGE[1], chatter);
    const collisionCooldownMs = lerp(CHATTER_COOLDOWN_RANGE[0], CHATTER_COOLDOWN_RANGE[1], chatter);
    const breedChance = lerp(FERTILITY_CHANCE_RANGE[0], FERTILITY_CHANCE_RANGE[1], fertility);
    const breedCooldownMs = lerp(FERTILITY_COOLDOWN_RANGE[0], FERTILITY_COOLDOWN_RANGE[1], fertility);
    const birthVelocityScale = lerp(VIGOUR_BIRTH_RANGE[0], VIGOUR_BIRTH_RANGE[1], vigour);

    for (const o of this.organismList) {
      if (!o.held && Math.hypot(o.vx, o.vy) < AMBIENT_SLEEP_SPEED) {
        const angle = this.rng() * Math.PI * 2;
        o.vx += Math.cos(angle) * ambientImpulse;
        o.vy += Math.sin(angle) * ambientImpulse;
      }
      integrate(o, dt, drag);
      bounceWalls(o, this.width, this.height, wallRestitution);
    }

    this.grid.rebuild(this.organismList, this.width, this.height);
    this.grid.forEachPair((a, b) => {
      const contact = resolvePair(a, b);
      if (!contact) return;

      if (contact.speed >= minCollisionSpeed) {
        const aReady = now - a.lastSoundAt >= collisionCooldownMs;
        const bReady = now - b.lastSoundAt >= collisionCooldownMs;
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

      this.maybeBreed(a, b, contact.speed, now, births, breedChance, breedCooldownMs, birthVelocityScale);
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

  private maybeBreed(
    a: Organism,
    b: Organism,
    speed: number,
    now: number,
    births: BirthEvent[],
    breedChance: number,
    breedCooldownMs: number,
    birthVelocityScale: number,
  ): void {
    if (this.organismList.length >= MAX_POPULATION) return;

    // BREED_MIN_ENERGY is a constant, not a WorldParams knob — fertility
    // must never relax it, or idle drift breeds at rest. See Issue 13.
    const energy = Math.min(1, speed / MAX_EVENT_SPEED);
    if (energy < BREED_MIN_ENERGY) return;
    if (this.rng() >= breedChance) return;

    const parent = this.rng() < 0.5 ? a : b;
    const partner = parent === a ? b : a;
    if (now - parent.lastBredAt < breedCooldownMs) return;

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
      parent.vx * birthVelocityScale,
      parent.vy * birthVelocityScale,
    );
    this.organismList.push(child);
    parent.lastBredAt = now;
    births.push({ child, parent });
  }
}

export function createWorld(options: WorldOptions): World {
  return new WorldImpl(options);
}

import { describe, expect, it } from "vitest";
import {
  AMBIENT_IMPULSE,
  AMBIENT_SLEEP_SPEED,
  BOUNCE_WALL_RANGE,
  BREED_CHANCE,
  CHATTER_COOLDOWN_RANGE,
  CHATTER_SPEED_RANGE,
  COLLISION_COOLDOWN_MS,
  DRAG,
  FERTILITY_CHANCE_RANGE,
  MAX_POPULATION,
  MIN_COLLISION_SPEED,
  PARAM_DEFAULTS,
  VIGOUR_IMPULSE_RANGE,
  VISCOSITY_DRAG_RANGE,
  WALL_RESTITUTION,
} from "../src/lib/constants";
import { randomGenome } from "../src/lib/genetics";
import { createWorld } from "../src/lib/sim/world";

const lerp = (range: readonly [number, number], t: number) => range[0] + (range[1] - range[0]) * t;

function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Issue 13 — the no-silent-retune guarantee: at PARAM_DEFAULTS, every knob
 * must reproduce the constant it stands in for, to within 1e-9. Adding
 * sliders must not be a way to silently retune an instrument that was
 * tuned by ear.
 *
 * `chatter` is the knob to watch: it drives both MIN_COLLISION_SPEED and
 * COLLISION_COOLDOWN_MS from a single 0..1 position, so its two ranges have
 * to share a preimage. The endpoints Issue 13 first specified did not, and
 * CHATTER_COOLDOWN_RANGE was adjusted so they do. Both halves are asserted
 * exact below; if a retune makes either approximate, fix the range rather
 * than the assertion.
 */
describe("Issue 13 — PARAM_DEFAULTS reproduce today's constants", () => {
  it("fertility -> BREED_CHANCE", () => {
    expect(lerp(FERTILITY_CHANCE_RANGE, PARAM_DEFAULTS.fertility)).toBeCloseTo(BREED_CHANCE, 9);
  });

  it("vigour -> AMBIENT_IMPULSE", () => {
    expect(lerp(VIGOUR_IMPULSE_RANGE, PARAM_DEFAULTS.vigour)).toBeCloseTo(AMBIENT_IMPULSE, 9);
  });

  it("viscosity -> DRAG", () => {
    expect(lerp(VISCOSITY_DRAG_RANGE, PARAM_DEFAULTS.viscosity)).toBeCloseTo(DRAG, 9);
  });

  it("bounce -> WALL_RESTITUTION", () => {
    expect(lerp(BOUNCE_WALL_RANGE, PARAM_DEFAULTS.bounce)).toBeCloseTo(WALL_RESTITUTION, 9);
  });

  it("chatter -> MIN_COLLISION_SPEED", () => {
    expect(lerp(CHATTER_SPEED_RANGE, PARAM_DEFAULTS.chatter)).toBeCloseTo(MIN_COLLISION_SPEED, 9);
  });

  it("chatter -> COLLISION_COOLDOWN_MS", () => {
    // Exact, like every other knob: CHATTER_COOLDOWN_RANGE's top end was
    // chosen so that the same 5/7 that reproduces MIN_COLLISION_SPEED also
    // reproduces this. If a retune of either chatter range makes this go
    // approximate again, re-derive the endpoint rather than loosening this.
    expect(lerp(CHATTER_COOLDOWN_RANGE, PARAM_DEFAULTS.chatter)).toBeCloseTo(
      COLLISION_COOLDOWN_MS,
      9,
    );
  });
});

describe("Issue 13 — fertility drives births without relaxing BREED_MIN_ENERGY", () => {
  it("births at fertility 1 are strictly more than at fertility 0 over 60s, population stays capped", () => {
    function run(fertility: number): number {
      const rng = seeded(20260825);
      const world = createWorld({ width: 900, height: 600, rng, drift: 0.5 });
      world.setParam("fertility", fertility);
      for (let i = 0; i < 20; i++) {
        world.spawn(randomGenome(rng), rng() * 900, rng() * 600, {
          vx: (rng() - 0.5) * 1600,
          vy: (rng() - 0.5) * 1600,
        });
      }
      let now = 0;
      let births = 0;
      for (let frame = 0; frame < 3600; frame++) {
        now += 1000 / 60;
        const result = world.step(1 / 60, now);
        births += result.births.length;
        expect(world.organisms.length).toBeLessThanOrEqual(MAX_POPULATION);
      }
      return births;
    }

    const zero = run(0);
    const one = run(1);
    expect(one).toBeGreaterThan(zero);
  });
});

describe("Issue 13 — viscosity brings a moving plate to rest faster", () => {
  it("viscosity 1 drops below AMBIENT_SLEEP_SPEED sooner than viscosity 0", () => {
    function framesToSleep(viscosity: number): number {
      const rng = seeded(7);
      const world = createWorld({ width: 500, height: 400, rng });
      world.setParam("viscosity", viscosity);
      // A single fast-moving organism, alone, so no collisions or ambient
      // re-kicks confound the measurement of DRAG alone.
      world.spawn(
        // lifespan: 1 -> the long end of LIFESPAN_RANGE, so the organism
        // outlives this measurement regardless of viscosity.
        { ...randomGenome(rng), size: 0.3, lifespan: 1 },
        250,
        200,
        { vx: 400, vy: 0 },
      );
      let now = 0;
      for (let frame = 0; frame < 1800; frame++) {
        now += 1000 / 60;
        world.step(1 / 60, now);
        const [o] = world.organisms;
        if (!o) throw new Error("organism died before the measurement window closed");
        if (Math.hypot(o.vx, o.vy) < AMBIENT_SLEEP_SPEED) return frame;
      }
      return Infinity;
    }

    expect(framesToSleep(1)).toBeLessThan(framesToSleep(0));
  });
});

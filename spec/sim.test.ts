import { expect, it } from "vitest";
import {
  COLLISION_COOLDOWN_MS,
  CULL_TARGET,
  MAX_POPULATION,
  MIN_COLLISION_SPEED,
} from "../src/lib/constants";
import { randomGenome } from "../src/lib/genetics";
import { createWorld } from "../src/lib/sim/world";
import { describeWhenImplemented } from "./support/dormant";

function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const probe = () => createWorld({ width: 800, height: 600, rng: seeded(1) });

describeWhenImplemented("I1 — the population is bounded", probe, () => {
  it("stays under MAX_POPULATION through 60 simulated seconds of abuse", () => {
    const rng = seeded(20260824);
    const world = createWorld({ width: 900, height: 600, rng, drift: 1 });
    let now = 0;
    for (let frame = 0; frame < 3600; frame++) {
      // Spawn far faster than any human could tap.
      for (let i = 0; i < 3; i++) {
        world.spawn(randomGenome(rng), rng() * 900, rng() * 600);
      }
      now += 1000 / 60;
      world.step(1 / 60, now);
      expect(
        world.organisms.length,
        `frame ${frame}: population ran away`,
      ).toBeLessThanOrEqual(MAX_POPULATION);
    }
  });

  it("culls with hysteresis, not one per frame at the boundary", () => {
    expect(CULL_TARGET).toBeLessThan(MAX_POPULATION);
  });

  it("refuses a spawn at the cap rather than culling to make room", () => {
    // The player's tap must never evict an ambient cell silently — but
    // more importantly, spawn must not be a back door around the cap.
    const rng = seeded(2);
    const world = createWorld({ width: 400, height: 300, rng });
    for (let i = 0; i < MAX_POPULATION + 50; i++) {
      world.spawn(randomGenome(rng), rng() * 400, rng() * 300);
    }
    expect(world.organisms.length).toBeLessThanOrEqual(MAX_POPULATION);
    expect(world.spawn(randomGenome(rng), 10, 10)).toBeNull();
  });

  it("empties on clear", () => {
    const rng = seeded(4);
    const world = createWorld({ width: 400, height: 300, rng });
    for (let i = 0; i < 20; i++) world.spawn(randomGenome(rng), rng() * 400, rng() * 300);
    world.clear();
    world.step(1 / 60, 16);
    expect(world.organisms.length).toBe(0);
  });
});

describeWhenImplemented("I5 — collision events are rate limited", probe, () => {
  it("never emits two events for one organism inside the cooldown", () => {
    const rng = seeded(1234);
    const world = createWorld({ width: 500, height: 400, rng });
    for (let i = 0; i < 120; i++) {
      world.spawn(randomGenome(rng), rng() * 500, rng() * 400, {
        vx: (rng() - 0.5) * 1200,
        vy: (rng() - 0.5) * 1200,
      });
    }
    const lastSound = new Map<number, number>();
    let now = 0;
    for (let frame = 0; frame < 1800; frame++) {
      now += 1000 / 60;
      const { collisions } = world.step(1 / 60, now);
      for (const event of collisions) {
        for (const organism of [event.a, event.b]) {
          const previous = lastSound.get(organism.id);
          if (previous !== undefined) {
            expect(
              now - previous,
              `organism ${organism.id} sounded twice within the cooldown`,
            ).toBeGreaterThanOrEqual(COLLISION_COOLDOWN_MS - 1e-6);
          }
          lastSound.set(organism.id, now);
        }
      }
    }
  });

  it("emits no event below MIN_COLLISION_SPEED — a resting pile is silent", () => {
    const rng = seeded(9);
    const world = createWorld({ width: 300, height: 200, rng });
    for (let i = 0; i < 40; i++) {
      world.spawn(randomGenome(rng), 150 + (rng() - 0.5) * 4, 100 + (rng() - 0.5) * 4, {
        vx: 0,
        vy: 0,
      });
    }
    let now = 0;
    for (let frame = 0; frame < 600; frame++) {
      now += 1000 / 60;
      for (const event of world.step(1 / 60, now).collisions) {
        expect(event.speed).toBeGreaterThanOrEqual(MIN_COLLISION_SPEED);
      }
    }
  });

  it("normalises every event's energy into 0..1", () => {
    const rng = seeded(77);
    const world = createWorld({ width: 500, height: 400, rng });
    for (let i = 0; i < 80; i++) {
      world.spawn(randomGenome(rng), rng() * 500, rng() * 400, {
        vx: (rng() - 0.5) * 4000,
        vy: (rng() - 0.5) * 4000,
      });
    }
    let now = 0;
    for (let frame = 0; frame < 600; frame++) {
      now += 1000 / 60;
      for (const event of world.step(1 / 60, now).collisions) {
        expect(event.energy).toBeGreaterThanOrEqual(0);
        expect(event.energy).toBeLessThanOrEqual(1);
      }
    }
  });
});

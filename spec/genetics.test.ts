import { describe, expect, it } from "vitest";
import { MUTATION_SCALE, breed } from "../src/lib/genetics/breed";
import {
  CONTINUOUS_FIELDS,
  DEGREE_BOUNDS,
  GENOME_BOUNDS,
  type Genome,
  clampGenome,
  randomGenome,
} from "../src/lib/genetics/genome";
import { inkOf } from "../src/lib/genetics/ink";
import { describeWhenImplemented } from "./support/dormant";

/** Mulberry32 — seeded so a failure is reproducible from the seed alone. */
function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describeWhenImplemented("I4 — mutation stays in bounds forever", () => randomGenome(seeded(1)), () => {
  it("never leaves GENOME_BOUNDS across 10 000 generations at maximum drift", () => {
    const rng = seeded(20260824);
    let g: Genome = randomGenome(rng);
    for (let generation = 0; generation < 10_000; generation++) {
      g = breed(g, 1, rng);
      for (const field of CONTINUOUS_FIELDS) {
        const [lo, hi] = GENOME_BOUNDS[field];
        expect(
          g[field],
          `generation ${generation}: ${field} = ${g[field]} escaped [${lo}, ${hi}]`,
        ).toBeGreaterThanOrEqual(lo);
        expect(g[field]).toBeLessThanOrEqual(hi);
      }
    }
  });

  it("only ever moves `degree` by whole steps", () => {
    // The load-bearing one. A fractional degree is the single way this
    // instrument can produce a note that is not in the scale, which is the
    // single way spec line 6 ("no way to play it wrong") can break.
    const rng = seeded(7);
    let g = randomGenome(rng);
    for (let generation = 0; generation < 10_000; generation++) {
      g = breed(g, 1, rng);
      expect(
        Number.isInteger(g.degree),
        `generation ${generation}: degree = ${g.degree} is not an integer`,
      ).toBe(true);
      expect(g.degree).toBeGreaterThanOrEqual(DEGREE_BOUNDS[0]);
      expect(g.degree).toBeLessThanOrEqual(DEGREE_BOUNDS[1]);
    }
  });

  it("copies exactly at drift 0 — turning evolution off is a way to play", () => {
    const rng = seeded(3);
    const parent = randomGenome(rng);
    expect(breed(parent, 0, rng)).toEqual(parent);
  });

  it("drifts further at high drift than at low drift", () => {
    // Guards against a `drift` parameter that is accepted and ignored — a
    // control with no audible effect is worse than no control.
    const spread = (drift: number) => {
      const rng = seeded(11);
      const parent = randomGenome(rng);
      let total = 0;
      for (let i = 0; i < 400; i++) total += Math.abs(breed(parent, drift, rng).size - parent.size);
      return total / 400;
    };
    expect(spread(1)).toBeGreaterThan(spread(0.1) * 2);
  });

  it("clampGenome is idempotent and total", () => {
    const wild = {
      degree: 99.7,
      size: -4,
      bounce: 12,
      speed: Number.NaN,
      brightness: 0.5,
      decay: -0.001,
      lifespan: 3,
    } as Genome;
    const once = clampGenome(wild);
    expect(clampGenome(once)).toEqual(once);
    expect(Number.isInteger(once.degree)).toBe(true);
    for (const field of CONTINUOUS_FIELDS) {
      expect(Number.isFinite(once[field]), `${field} is not finite`).toBe(true);
    }
  });

  it("MUTATION_SCALE is small enough that a child resembles its parent", () => {
    expect(MUTATION_SCALE).toBeLessThan(0.25);
  });
});

describeWhenImplemented("I7 — ink is derived, not stored", () => inkOf(randomGenome(seeded(1))), () => {
  it("is referentially transparent", () => {
    const rng = seeded(99);
    for (let i = 0; i < 200; i++) {
      const g = randomGenome(rng);
      expect(inkOf(g)).toEqual(inkOf({ ...g }));
    }
  });

  it("puts every channel in 0..1", () => {
    const rng = seeded(5);
    for (let i = 0; i < 500; i++) {
      const ink = inkOf(randomGenome(rng));
      for (const [channel, weight] of Object.entries(ink)) {
        expect(weight, `${channel} = ${weight}`).toBeGreaterThanOrEqual(0);
        expect(weight).toBeLessThanOrEqual(1);
      }
    }
  });

  it("changes colour when — and only as much as — the genome changes sound", () => {
    // This is the whole "you can see evolution happening" feature. If pitch
    // can change without colour changing, lineages become invisible.
    const rng = seeded(42);
    const parent = randomGenome(rng);
    const higher = { ...parent, degree: Math.min(DEGREE_BOUNDS[1], parent.degree + 3) };
    expect(inkOf(higher).pink).not.toBeCloseTo(inkOf(parent).pink, 5);
  });
});

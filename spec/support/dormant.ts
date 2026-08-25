import { describe } from "vitest";

import { createEngine } from "../../src/lib/audio/engine";
import { freq } from "../../src/lib/audio/scales";
import { breed } from "../../src/lib/genetics/breed";
import { genomeFromGesture, randomGenome } from "../../src/lib/genetics/genome";
import { inkOf } from "../../src/lib/genetics/ink";
import { attachPointer } from "../../src/lib/interaction/pointer";
import { drawPopulation } from "../../src/lib/render/cells";
import { createLayers } from "../../src/lib/render/layers";
import { createWorld } from "../../src/lib/sim/world";

/**
 * Suites that arm themselves.
 *
 * The invariant tests were written before the code they test, which is the
 * point — they are the sensors the build steers against. But a repo rule
 * here says never commit a red state, and a scaffold full of deliberately
 * failing tests is a red state that teaches you to ignore red.
 *
 * So a suite whose module is still a stub stays DORMANT, and wakes up on
 * its own the first time the module stops throwing "not implemented".
 * Nobody has to remember to un-skip anything; implementing the function is
 * what arms its tests.
 *
 * The safety net is `readiness.test.ts`: with CULTURE_SHIP=1 it fails if
 * any suite is still dormant, so a dormant sensor can never be mistaken
 * for a passing one at ship time.
 *
 * That net cannot be built out of a module-level registry. Vitest gives
 * every test FILE its own module graph, so a set populated in
 * `sim.test.ts` is invisible to `readiness.test.ts` — the gate passes
 * while three suites sleep, which is the precise failure it exists to
 * catch. So readiness re-probes the modules itself, via SCAFFOLD, and the
 * registry below is only ever used for the console note within one file.
 */

const dormant = new Set<string>();

/** True when `probe` throws the scaffold's not-implemented error. */
export function isStub(probe: () => unknown): boolean {
  try {
    probe();
    return false;
  } catch (error) {
    return error instanceof Error && /not implemented/i.test(error.message);
  }
}

export function describeWhenImplemented(
  name: string,
  probe: () => unknown,
  suite: () => void,
): void {
  if (isStub(probe)) {
    dormant.add(name);
    describe.skip(`${name} [dormant: module is still a stub]`, suite);
    return;
  }
  describe(name, suite);
}

export const dormantSuites = (): string[] => [...dormant].sort();

/**
 * Every function the scaffold ships as a stub, and the issue that
 * implements it. This is the manifest readiness reads.
 *
 * Adding a stub without adding it here is the one way to get a sensor
 * past the gate, so treat the list as part of the stub: if you write
 * `throw new Error("not implemented")`, you add a line here.
 */
export const SCAFFOLD: { label: string; issue: number; probe: () => unknown }[] = [
  { label: "genetics/genome.randomGenome", issue: 1, probe: () => randomGenome(() => 0.5) },
  { label: "genetics/genome.genomeFromGesture", issue: 1, probe: () => genomeFromGesture(0.5, 0.5, () => 0.5) },
  { label: "genetics/breed.breed", issue: 1, probe: () => breed(randomGenome(() => 0.5), 0.3, () => 0.5) },
  { label: "genetics/ink.inkOf", issue: 1, probe: () => inkOf(randomGenome(() => 0.5)) },
  { label: "audio/scales.freq", issue: 2, probe: () => freq(0, "bright") },
  { label: "audio/engine.createEngine", issue: 2, probe: () => createEngine() },
  { label: "sim/world.createWorld", issue: 3, probe: () => createWorld({ width: 100, height: 100 }) },
  { label: "interaction/pointer.attachPointer", issue: 4, probe: () => attachPointer(null as never) },
  { label: "render/layers.createLayers", issue: 5, probe: () => createLayers(null as never, 10, 10) },
  { label: "render/cells.drawPopulation", issue: 5, probe: () => drawPopulation(null as never, [], 0, null as never) },
];

/** Labels of everything still unimplemented, cheapest possible check. */
export const stillStubbed = (): string[] =>
  SCAFFOLD.filter((entry) => isStub(entry.probe)).map(
    (entry) => `${entry.label} (issue ${entry.issue})`,
  );

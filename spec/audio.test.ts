import { describe, expect, it } from "vitest";
import { VOICE_CAP } from "../src/lib/constants";
import { createEngine } from "../src/lib/audio/engine";
import { MOODS, MOOD_ORDER, SCALE_SPAN, freq } from "../src/lib/audio/scales";
import { VoicePool } from "../src/lib/audio/voices";
import { FakeAudioContext, asContext } from "./support/fake-audio";
import { describeWhenImplemented } from "./support/dormant";

const midiOf = (hz: number) => 69 + 12 * Math.log2(hz / 440);

describeWhenImplemented("I3 — every note is in the scale", () => freq(0, "bright"), () => {
  for (const mood of MOOD_ORDER) {
    const { root, steps } = MOODS[mood];

    it(`${mood}: every degree lands on a scale tone`, () => {
      for (let degree = 0; degree < SCALE_SPAN; degree++) {
        const midi = midiOf(freq(degree, mood));
        expect(midi, `degree ${degree} is between two notes`).toBeCloseTo(Math.round(midi), 6);
        const interval = ((Math.round(midi) - root) % 12 + 12) % 12;
        expect(
          steps.includes(interval),
          `degree ${degree} → midi ${Math.round(midi)} → interval ${interval}, not in [${steps}]`,
        ).toBe(true);
      }
    });

    it(`${mood}: out-of-range degrees clamp rather than throw`, () => {
      // A clamped note is musical; an exception is silence, and silence in
      // an instrument reads as broken.
      for (const degree of [-40, -1, SCALE_SPAN, 900]) {
        expect(() => freq(degree, mood)).not.toThrow();
        expect(Number.isFinite(freq(degree, mood))).toBe(true);
      }
    });

    it(`${mood}: rises monotonically with degree`, () => {
      for (let degree = 1; degree < SCALE_SPAN; degree++) {
        expect(freq(degree, mood)).toBeGreaterThan(freq(degree - 1, mood));
      }
    });
  }

  it("no module outside audio/scales.ts converts to Hz", async () => {
    // A source-level sensor for the rule that makes I3 hold by
    // construction. If another module starts doing pitch maths, this fails
    // long before anybody hears an out-of-key note.
    const { readdirSync, readFileSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((entry) => {
        const path = join(dir, entry);
        return statSync(path).isDirectory() ? walk(path) : [path];
      });
    const offenders = walk("src/lib")
      .filter((path) => path.endsWith(".ts") && !path.endsWith("scales.ts"))
      .filter((path) => /440\s*\*|Math\.pow\(\s*2\s*,|2\s*\*\*\s*\(/.test(readFileSync(path, "utf8")));
    expect(
      offenders,
      "pitch maths outside audio/scales.ts — see plan.md §5.2",
    ).toEqual([]);
  });
});

describe("I2 — the voice cap holds", () => {
  it("never exceeds VOICE_CAP however many notes arrive", () => {
    const ctx = new FakeAudioContext();
    const bus = ctx.createGain();
    const pool = new VoicePool(asContext(ctx), bus as unknown as AudioNode);
    for (let i = 0; i < VOICE_CAP * 8; i++) {
      pool.play({ frequency: 220 + i, level: 0.5, brightness: 0.5, decay: 0.4, pan: 0 });
      expect(pool.active, `after ${i + 1} notes`).toBeLessThanOrEqual(VOICE_CAP);
    }
  });

  it("steals an un-held voice before a held one — the gesture wins", () => {
    // The player's finger outranks the ecosystem. If a collision can cut
    // off the note somebody is currently holding, the instrument talks
    // over the person playing it.
    const ctx = new FakeAudioContext();
    const bus = ctx.createGain();
    const pool = new VoicePool(asContext(ctx), bus as unknown as AudioNode);
    const held = pool.hold({ frequency: 330, level: 0.6, brightness: 0.5, decay: 0.5, pan: 0 });
    for (let i = 0; i < VOICE_CAP * 4; i++) {
      pool.play({ frequency: 440 + i, level: 0.4, brightness: 0.5, decay: 0.3, pan: 0 });
    }
    expect(held.done, "the held voice was stolen").toBe(false);
  });

  it("fades a stolen voice instead of cutting it — a hard stop is a click", () => {
    const ctx = new FakeAudioContext();
    const bus = ctx.createGain();
    const pool = new VoicePool(asContext(ctx), bus as unknown as AudioNode);
    for (let i = 0; i < VOICE_CAP + 1; i++) {
      pool.play({ frequency: 300, level: 0.5, brightness: 0.5, decay: 0.4, pan: 0 });
    }
    const first = ctx.oscillators[0];
    expect(first?.stopped).toBe(true);
    expect(first?.stopTime, "stolen voice stops instantly").toBeGreaterThan(ctx.currentTime);
  });

  it("releases every voice on releaseAll", () => {
    const ctx = new FakeAudioContext();
    const bus = ctx.createGain();
    const pool = new VoicePool(asContext(ctx), bus as unknown as AudioNode);
    for (let i = 0; i < 6; i++) {
      pool.play({ frequency: 300, level: 0.5, brightness: 0.5, decay: 0.4, pan: 0 });
    }
    pool.releaseAll();
    ctx.advance(10);
    expect(pool.active).toBe(0);
  });
});

describeWhenImplemented("I6 — nothing sounds before the first gesture", () => createEngine({ context: asContext(new FakeAudioContext()) }), () => {
  it("creates its context suspended", () => {
    const ctx = new FakeAudioContext();
    createEngine({ context: asContext(ctx) });
    expect(ctx.state).toBe("suspended");
  });

  it("reports not-started until resume", async () => {
    const ctx = new FakeAudioContext();
    const engine = createEngine({ context: asContext(ctx) });
    expect(engine.started).toBe(false);
    await engine.resume();
    expect(engine.started).toBe(true);
    expect(ctx.state).toBe("running");
  });
});

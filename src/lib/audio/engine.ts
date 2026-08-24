/**
 * AudioContext lifecycle and the master chain. REFERENCE IMPLEMENTATION.
 *
 * The one thing here that is easy to get wrong and expensive to get wrong:
 * the context must exist in the SUSPENDED state until a user gesture
 * resumes it (invariant I6). Browsers enforce this anyway, but the failure
 * mode when you fight it is not "no sound" — it is "no sound for the first
 * few taps, then sound", which reads to a stranger as a broken instrument
 * and is exactly the impression a cold-open crit forms in its first five
 * seconds.
 *
 * The master chain is deliberately conservative:
 *
 *   voices → bus → compressor → limiter → master → destination
 *
 * Two stages of dynamics, not one. The compressor does musical glue; the
 * limiter is a brick wall so that a pile-up of collisions clips the
 * limiter instead of the DAC. Digital clipping on a laptop speaker is the
 * single ugliest sound this project can make.
 */

import { MASTER_GAIN } from "../constants";
import { type Mood, freq } from "./scales";
import { type HeldVoice, type Note, VoicePool } from "./voices";

export type Engine = {
  /** Play one note, identified by scale degree. */
  play(spec: NoteSpec): void;
  /** Start a sustained note; the handle glides and releases it. */
  hold(spec: NoteSpec): HeldVoice;
  /** Resume the context. Must be called from a user-gesture handler. */
  resume(): Promise<void>;
  /** True once a gesture has resumed the context. */
  readonly started: boolean;
  /** Live voice count — invariant I2 reads this. */
  readonly activeVoices: number;
  setMood(mood: Mood): void;
  readonly mood: Mood;
  /** 0..1, the LEVEL control. */
  setLevel(level: number): void;
  releaseAll(): void;
  /** Escape hatch for tests and for the sound bench. */
  readonly context: BaseAudioContext;
};

/**
 * A note as the rest of the codebase speaks it: a scale DEGREE, never a
 * frequency. `engine` is the boundary where degrees become Hz.
 */
export type NoteSpec = {
  degree: number;
  level: number;
  brightness: number;
  decay: number;
  pan: number;
};

export type EngineOptions = {
  /** Injected so tests can pass a mock and the bench can share a context. */
  context?: BaseAudioContext;
  mood?: Mood;
};

export function createEngine(options: EngineOptions = {}): Engine {
  const context = options.context ?? new AudioContext();
  const { input, master } = createMasterChain(context);
  const pool = new VoicePool(context, input);

  let mood: Mood = options.mood ?? "bright";
  let started = false;

  const noteFor = (spec: NoteSpec): Note => ({
    frequency: freq(spec.degree, mood),
    level: spec.level,
    brightness: spec.brightness,
    decay: spec.decay,
    pan: spec.pan,
  });

  return {
    play(spec) {
      pool.play(noteFor(spec));
    },
    hold(spec) {
      return pool.hold(noteFor(spec));
    },
    async resume() {
      // BaseAudioContext has no resume() — only AudioContext and the fake
      // used in tests do, and both implement it, so this is a safe cast.
      await (context as AudioContext).resume();
      started = true;
    },
    get started() {
      return started;
    },
    get activeVoices() {
      return pool.active;
    },
    setMood(next) {
      mood = next;
    },
    get mood() {
      return mood;
    },
    setLevel(level) {
      const t = context.currentTime;
      master.gain.setTargetAtTime(Math.max(0, Math.min(1, level)) * MASTER_GAIN, t, 0.02);
    },
    releaseAll() {
      pool.releaseAll();
    },
    get context() {
      return context;
    },
  };
}

/**
 * Build the master chain onto a context and return the node voices should
 * connect to. Reference implementation: correct as written.
 */
export function createMasterChain(ctx: BaseAudioContext): {
  input: AudioNode;
  master: GainNode;
} {
  const bus = ctx.createGain();
  bus.gain.value = 1;

  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -18;
  compressor.knee.value = 12;
  compressor.ratio.value = 6;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.18;

  // Brick wall. Ratio 20 with a 1ms attack is a limiter in all but name.
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -3;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.05;

  const master = ctx.createGain();
  master.gain.value = MASTER_GAIN;

  bus.connect(compressor).connect(limiter).connect(master).connect(ctx.destination);
  return { input: bus, master };
}

export { freq, VoicePool };
export type { HeldVoice, Mood, Note };

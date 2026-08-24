/**
 * The voice pool. REFERENCE IMPLEMENTATION — this is working code, not a
 * stub. Read it before you change it.
 *
 * It is written out in full because every bug in this file is *inaudible
 * until it isn't*: a missing ramp is a click you only hear on a good pair
 * of headphones, a leaked voice is a drone that appears after ten minutes
 * of play, and a voice cap that counts wrong only fails when the pod is
 * hammering the canvas at the crit. None of those show up in a type check,
 * and only one of them shows up in a test.
 *
 * Two rules it exists to enforce:
 *
 *   I2  live voices never exceed VOICE_CAP
 *   —   no gain is ever assigned directly; every change is a ramp
 *
 * The stealing policy is the part worth understanding: when the pool is
 * full we steal the OLDEST voice, but never a HELD one. A held voice is the
 * player's finger currently on the surface — cutting it to make room for an
 * ambient collision would mean the instrument talks over the person playing
 * it. Collisions are the accompaniment; the gesture always wins.
 */

import {
  ATTACK_RANGE,
  CUTOFF_RANGE,
  PARTIAL_GAIN,
  RELEASE_RANGE,
  STEAL_FADE,
  VOICE_CAP,
} from "../constants";

export type Note = {
  /** Integer scale degree. Converted to Hz by the caller via scales.freq. */
  frequency: number;
  /** 0..1, pre-master. */
  level: number;
  /** 0..1 → filter cutoff and harmonic content. */
  brightness: number;
  /** 0..1 → release length. */
  decay: number;
  /** -1..1 */
  pan: number;
};

export type HeldVoice = {
  /** Retune and reshape a sounding voice — the drag-to-glide gesture. */
  update(note: Partial<Note>): void;
  /** Start the release tail. Idempotent. */
  release(): void;
  readonly done: boolean;
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Below this the exponential ramps break (they cannot reach zero). */
const NEAR_ZERO = 0.0001;
/** Glide time for retuning a held voice. Short enough to feel immediate,
 *  long enough that it reads as portamento rather than a jump. */
const GLIDE = 0.06;

type VoiceNodes = {
  osc: OscillatorNode;
  partial: OscillatorNode;
  partialGain: GainNode;
  filter: BiquadFilterNode;
  env: GainNode;
  pan: StereoPannerNode;
};

class Voice {
  readonly startedAt: number;
  held: boolean;
  done = false;

  private readonly ctx: BaseAudioContext;
  private readonly n: VoiceNodes;
  private releasing = false;
  private releaseSeconds: number;

  constructor(ctx: BaseAudioContext, destination: AudioNode, note: Note, held: boolean) {
    this.ctx = ctx;
    this.held = held;
    this.startedAt = ctx.currentTime;
    this.releaseSeconds = lerp(RELEASE_RANGE[0], RELEASE_RANGE[1], clamp01(note.decay));

    const t = ctx.currentTime;
    const brightness = clamp01(note.brightness);

    // A sine fundamental with a triangle partial an octave up, mixed in by
    // brightness. Two cheap oscillators buy the difference between "a beep"
    // and "a plucked thing"; a single sine at 200 voices sounds like a
    // hearing test.
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(note.frequency, t);

    const partial = ctx.createOscillator();
    partial.type = "triangle";
    partial.frequency.setValueAtTime(note.frequency * 2, t);

    const partialGain = ctx.createGain();
    partialGain.gain.setValueAtTime(PARTIAL_GAIN * brightness, t);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(lerp(CUTOFF_RANGE[0], CUTOFF_RANGE[1], brightness), t);
    filter.Q.setValueAtTime(0.7, t);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);

    const pan = ctx.createStereoPanner();
    pan.pan.setValueAtTime(Math.max(-1, Math.min(1, note.pan)), t);

    osc.connect(filter);
    partial.connect(partialGain).connect(filter);
    filter.connect(env).connect(pan).connect(destination);

    this.n = { osc, partial, partialGain, filter, env, pan };

    // Attack. Brighter notes attack faster — a bright sound with a slow
    // attack reads as a swell, not a pluck.
    const attack = lerp(ATTACK_RANGE[1], ATTACK_RANGE[0], brightness);
    const peak = Math.max(NEAR_ZERO, clamp01(note.level));
    env.gain.linearRampToValueAtTime(peak, t + attack);

    osc.start(t);
    partial.start(t);

    if (!held) {
      // One-shot: schedule the whole tail now, so a dropped frame or a
      // stalled main thread can never leave this note sounding.
      this.scheduleRelease(t + attack);
    }
  }

  private scheduleRelease(from: number) {
    if (this.releasing) return;
    this.releasing = true;
    const end = from + this.releaseSeconds;
    this.n.env.gain.exponentialRampToValueAtTime(NEAR_ZERO, end);
    this.stopAt(end + 0.02);
  }

  private stopAt(when: number) {
    const finish = () => {
      if (this.done) return;
      this.done = true;
      // Disconnect explicitly. Ended oscillators are collectable, but the
      // nodes downstream of them are not until the graph edge is cut, and
      // a few hundred orphaned filters per minute is a real leak.
      for (const node of Object.values(this.n)) node.disconnect();
    };
    this.n.osc.onended = finish;
    this.n.osc.stop(when);
    this.n.partial.stop(when);
  }

  update(note: Partial<Note>) {
    if (this.releasing || this.done) return;
    const t = this.ctx.currentTime;
    if (note.frequency !== undefined) {
      // setTargetAtTime, not setValueAtTime: an instant retune of a
      // sounding oscillator is a click, and the glide is the gesture.
      this.n.osc.frequency.setTargetAtTime(note.frequency, t, GLIDE);
      this.n.partial.frequency.setTargetAtTime(note.frequency * 2, t, GLIDE);
    }
    if (note.brightness !== undefined) {
      const b = clamp01(note.brightness);
      this.n.filter.frequency.setTargetAtTime(
        lerp(CUTOFF_RANGE[0], CUTOFF_RANGE[1], b),
        t,
        GLIDE,
      );
      this.n.partialGain.gain.setTargetAtTime(PARTIAL_GAIN * b, t, GLIDE);
    }
    if (note.level !== undefined) {
      this.n.env.gain.setTargetAtTime(Math.max(NEAR_ZERO, clamp01(note.level)), t, GLIDE);
    }
    if (note.pan !== undefined) {
      this.n.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, note.pan)), t, GLIDE);
    }
    if (note.decay !== undefined) {
      this.releaseSeconds = lerp(RELEASE_RANGE[0], RELEASE_RANGE[1], clamp01(note.decay));
    }
  }

  release() {
    this.scheduleRelease(this.ctx.currentTime);
  }

  /** Cut this voice short to make room. Fast fade, never an instant stop. */
  steal() {
    if (this.done) return;
    const t = this.ctx.currentTime;
    this.releasing = true;
    this.n.env.gain.cancelScheduledValues(t);
    // Re-anchor at the current value before ramping, or cancelScheduledValues
    // leaves the param wherever the last *scheduled* event put it and the
    // fade starts with a jump.
    this.n.env.gain.setValueAtTime(Math.max(NEAR_ZERO, this.n.env.gain.value), t);
    this.n.env.gain.exponentialRampToValueAtTime(NEAR_ZERO, t + STEAL_FADE);
    this.stopAt(t + STEAL_FADE + 0.01);
  }
}

export class VoicePool {
  private voices: Voice[] = [];

  constructor(
    private readonly ctx: BaseAudioContext,
    private readonly destination: AudioNode,
  ) {}

  /** Live voice count. Invariant I2 asserts this never exceeds VOICE_CAP. */
  get active(): number {
    this.reap();
    return this.voices.length;
  }

  play(note: Note): void {
    this.makeRoom();
    this.voices.push(new Voice(this.ctx, this.destination, note, false));
  }

  hold(note: Note): HeldVoice {
    this.makeRoom();
    const voice = new Voice(this.ctx, this.destination, note, true);
    this.voices.push(voice);
    return {
      update: (patch) => voice.update(patch),
      release: () => {
        voice.held = false;
        voice.release();
      },
      get done() {
        return voice.done;
      },
    };
  }

  /** Release everything — the `clear` control, and page teardown. */
  releaseAll(): void {
    for (const v of this.voices) v.release();
  }

  private reap() {
    if (this.voices.some((v) => v.done)) {
      this.voices = this.voices.filter((v) => !v.done);
    }
  }

  private makeRoom() {
    this.reap();
    while (this.voices.length >= VOICE_CAP) {
      // Prefer the oldest un-held voice. Only if every live voice is held
      // — the player has more fingers down than the cap, which the cap
      // makes unlikely — do we steal a held one.
      let victim = this.voices.find((v) => !v.held);
      victim ??= this.voices[0];
      if (!victim) return;
      victim.steal();
      this.voices = this.voices.filter((v) => v !== victim);
    }
  }
}

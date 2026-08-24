/**
 * A minimal BaseAudioContext good enough to assert the audio invariants
 * without a browser.
 *
 * It exists so that "voices never exceed the cap" and "the context starts
 * suspended" are cheap, fast, automatic checks rather than things somebody
 * remembers to eyeball. It deliberately does NOT model sound — no sensor
 * in this repo can hear, and pretending otherwise would be worse than
 * admitting it. Timbre is judged on the bench, by ear.
 */

class FakeParam implements Pick<AudioParam, "value"> {
  value = 0;
  readonly events: Array<{ kind: string; value?: number; time?: number }> = [];
  setValueAtTime(value: number, time: number) {
    this.value = value;
    this.events.push({ kind: "set", value, time });
    return this as unknown as AudioParam;
  }
  linearRampToValueAtTime(value: number, time: number) {
    this.value = value;
    this.events.push({ kind: "linear", value, time });
    return this as unknown as AudioParam;
  }
  exponentialRampToValueAtTime(value: number, time: number) {
    this.value = value;
    this.events.push({ kind: "exp", value, time });
    return this as unknown as AudioParam;
  }
  setTargetAtTime(value: number, time: number) {
    this.value = value;
    this.events.push({ kind: "target", value, time });
    return this as unknown as AudioParam;
  }
  cancelScheduledValues(time: number) {
    this.events.push({ kind: "cancel", time });
    return this as unknown as AudioParam;
  }
}

class FakeNode {
  readonly outputs: FakeNode[] = [];
  connected = true;
  connect(target: FakeNode) {
    this.outputs.push(target);
    return target;
  }
  disconnect() {
    this.connected = false;
    this.outputs.length = 0;
  }
}

class FakeOscillator extends FakeNode {
  type = "sine";
  readonly frequency = new FakeParam();
  onended: (() => void) | null = null;
  started = false;
  stopped = false;
  stopTime = Number.POSITIVE_INFINITY;
  start() {
    this.started = true;
  }
  stop(when = 0) {
    this.stopped = true;
    this.stopTime = when;
  }
  /** Tests call this to simulate the note actually finishing. */
  finish() {
    this.onended?.();
  }
}

class FakeGain extends FakeNode {
  readonly gain = new FakeParam();
}
class FakeFilter extends FakeNode {
  type = "lowpass";
  readonly frequency = new FakeParam();
  readonly Q = new FakeParam();
}
class FakePanner extends FakeNode {
  readonly pan = new FakeParam();
}
class FakeCompressor extends FakeNode {
  readonly threshold = new FakeParam();
  readonly knee = new FakeParam();
  readonly ratio = new FakeParam();
  readonly attack = new FakeParam();
  readonly release = new FakeParam();
}

export class FakeAudioContext {
  state: AudioContextState = "suspended";
  currentTime = 0;
  readonly destination = new FakeNode();
  readonly oscillators: FakeOscillator[] = [];

  createOscillator() {
    const osc = new FakeOscillator();
    this.oscillators.push(osc);
    return osc;
  }
  createGain() {
    return new FakeGain();
  }
  createBiquadFilter() {
    return new FakeFilter();
  }
  createStereoPanner() {
    return new FakePanner();
  }
  createDynamicsCompressor() {
    return new FakeCompressor();
  }
  async resume() {
    this.state = "running";
  }
  async suspend() {
    this.state = "suspended";
  }
  /** Advance the clock and fire `onended` for anything past its stop time. */
  advance(seconds: number) {
    this.currentTime += seconds;
    for (const osc of this.oscillators) {
      if (osc.stopped && osc.stopTime <= this.currentTime) osc.finish();
    }
  }
}

/** The cast is contained here so no test file has to do it. */
export const asContext = (fake: FakeAudioContext): BaseAudioContext =>
  fake as unknown as BaseAudioContext;

import type { Engine } from "../audio";
import type { World } from "../sim";

/**
 * The gesture grammar: tap · hold · release. This is the module the crit
 * actually judges — a pod plays it cold, and latency and feel are the
 * whole assessment.
 *
 * The rule that outranks everything else in this file:
 *
 *   A TAP MUST SOUND IN THE SAME EVENT HANDLER AS `pointerdown`.
 *
 * Not after the next simulation step, not on the next animation frame,
 * not after the organism is spawned. Call `engine.play` first, spawn
 * second. A frame of latency (16ms) is the difference between an
 * instrument and a web page that makes noises, and it is precisely what a
 * stranger notices in the first two seconds without being able to name it.
 *
 * The other rule, learned from every hung synth ever shipped:
 *
 *   EVERY PATH OUT OF A HOLD MUST RELEASE THE VOICE.
 *
 * pointerup, pointercancel, window blur, visibilitychange, and losing
 * pointer capture. A drone that will not stop while a tutor is holding
 * your laptop is the worst available outcome.
 */
export type PointerRig = {
  /** Remove every listener. Must release any held voice as it goes. */
  destroy(): void;
};

export type PointerDeps = {
  canvas: HTMLCanvasElement;
  world: World;
  engine: Engine;
  /** Called on the very first gesture of any kind: resumes audio, dismisses
   *  the invite. Idempotent. */
  onFirstGesture(): void;
  /** Charging cluster state, read by the renderer. */
  onChargeChange(charge: ChargeState | null): void;
};

export type ChargeState = {
  x: number;
  y: number;
  /** 0..1 toward HOLD_MAX_CLUSTER. */
  fullness: number;
  /** Accumulated offspring, drawn orbiting the nucleus. */
  count: number;
  degree: number;
};

/**
 * Wire up pointer input.
 *
 * Implementation notes that are contract, not suggestion:
 *  - Pointer Events only. `setPointerCapture` on pointerdown so a drag that
 *    leaves the canvas still tracks.
 *  - `touch-action: none` on the canvas (set in CSS, not here) or mobile
 *    scroll will eat every drag.
 *  - Press under HOLD_THRESHOLD_MS is a tap; at or over it, the hold voice
 *    has already started, so the tap branch must not double-trigger.
 *  - Moving during a hold updates the held voice's degree — that is the
 *    glide, and it is the most expressive thing in the instrument.
 *  - Release disperses along the drag vector, notes staggered by
 *    RELEASE_ARPEGGIO_MS. Stagger rather than stack: a true 12-note stack
 *    eats the whole voice cap and sounds like a cluster, an arpeggio at
 *    38ms reads as a chord and leaves room for the ecosystem underneath.
 */
export function attachPointer(_deps: PointerDeps): PointerRig {
  throw new Error("not implemented — see plan.md Issue 4");
}

/** Canvas-relative, normalised 0..1. yNorm 0 is the TOP. */
export function normalisePoint(
  _canvas: HTMLCanvasElement,
  _event: PointerEvent,
): { xNorm: number; yNorm: number } {
  throw new Error("not implemented — see plan.md Issue 4");
}

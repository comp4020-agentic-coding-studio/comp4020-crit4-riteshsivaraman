import { HOLD_NOTE_DECAY, HOLD_NOTE_LEVEL } from "../constants";
import type { Engine, HeldVoice } from "../audio";
import { DEGREE_BOUNDS, clampGenome, randomGenome } from "../genetics";
import type { World } from "../sim";

/**
 * The keyboard voice — a second expressive surface, not an accessibility
 * checkbox. Someone should be able to hold a chord on the home row while
 * dropping cells with the other hand.
 *
 * Same three verbs as the pointer, so there is one grammar to learn:
 * keydown plays and spawns, holding swells, keyup releases.
 */

/** Home row → scale degree. Left to right is low to high, matching the
 *  canvas's bottom-to-top, so the two surfaces agree about "higher". */
export const KEY_DEGREES: Readonly<Record<string, number>> = {
  KeyA: 0,
  KeyS: 2,
  KeyD: 4,
  KeyF: 5,
  KeyG: 7,
  KeyH: 9,
  KeyJ: 11,
  KeyK: 13,
};

export type KeyboardRig = { destroy(): void };

export type KeyboardDeps = {
  world: World;
  engine: Engine;
  onFirstGesture(): void;
  /** Where a key's cell appears: lanes across the canvas. */
  canvas: HTMLCanvasElement;
};

/**
 * Contract:
 *  - ignore `event.repeat` — auto-repeat would retrigger 30 notes a second
 *  - ignore keydowns with a modifier, and any keydown whose target is an
 *    input or the about dialog, so the page's own controls still work
 *  - keyup, blur and visibilitychange all release; a held key when the tab
 *    loses focus must not drone
 *  - `preventDefault` on handled keys only. Swallowing Tab breaks keyboard
 *    focus, which the quality floor requires.
 */
const KEY_CODES = Object.keys(KEY_DEGREES);
/** Fraction across the canvas, one lane per key, left-to-right in KEY_DEGREES order. */
const KEY_LANES: Readonly<Record<string, number>> = Object.fromEntries(
  KEY_CODES.map((code, i) => [code, (i + 0.5) / KEY_CODES.length]),
);

const panFromX = (xNorm: number): number => Math.max(-1, Math.min(1, xNorm * 2 - 1));
const brightnessFromX = (xNorm: number): number => Math.max(0, Math.min(1, xNorm));

/** Inverse of genetics/genome.degreeFromY, so a key's cell sits at the
 *  height its pitch would map to from the pointer — one visual language
 *  for "higher is higher" across both input surfaces. */
function yNormFromDegree(degree: number): number {
  const [lo, hi] = DEGREE_BOUNDS;
  return 1 - (degree - lo) / (hi - lo);
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.closest("dialog")) return true;
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
}

/**
 * Contract:
 *  - ignore `event.repeat` — auto-repeat would retrigger 30 notes a second
 *  - ignore keydowns with a modifier, and any keydown whose target is an
 *    input or the about dialog, so the page's own controls still work
 *  - keyup, blur and visibilitychange all release; a held key when the tab
 *    loses focus must not drone
 *  - `preventDefault` on handled keys only. Swallowing Tab breaks keyboard
 *    focus, which the quality floor requires.
 */
export function attachKeyboard(deps: KeyboardDeps): KeyboardRig {
  const { world, engine, onFirstGesture } = deps;
  const rng = Math.random;
  const held = new Map<string, HeldVoice>();

  function onKeyDown(event: KeyboardEvent): void {
    if (event.repeat) return;
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    const degree = KEY_DEGREES[event.code];
    if (degree === undefined) return;
    if (isEditableTarget(event.target)) return;
    if (held.has(event.code)) return;

    event.preventDefault();
    onFirstGesture();
    void engine.resume();

    const xNorm = KEY_LANES[event.code];
    const yNorm = yNormFromDegree(degree);
    const pan = panFromX(xNorm);
    const brightness = brightnessFromX(xNorm);
    const genome = clampGenome({ ...randomGenome(rng), degree });

    // Plays and spawns immediately, same handler as keydown — the same
    // no-perceptible-delay rule the pointer's tap follows.
    engine.play({ degree, level: genome.size, brightness, decay: genome.decay, pan });
    world.spawn(genome, xNorm * world.width, yNorm * world.height);

    held.set(
      event.code,
      engine.hold({ degree, level: HOLD_NOTE_LEVEL, brightness, decay: HOLD_NOTE_DECAY, pan }),
    );
  }

  function onKeyUp(event: KeyboardEvent): void {
    const voice = held.get(event.code);
    if (!voice) return;
    voice.release();
    held.delete(event.code);
  }

  function releaseAll(): void {
    for (const voice of held.values()) voice.release();
    held.clear();
  }

  const onBlur = () => releaseAll();
  const onVisibility = () => {
    if (document.hidden) releaseAll();
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  document.addEventListener("visibilitychange", onVisibility);

  return {
    destroy() {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibility);
      releaseAll();
    },
  };
}

import type { Engine } from "../audio";
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
export function attachKeyboard(_deps: KeyboardDeps): KeyboardRig {
  throw new Error("not implemented — see plan.md Issue 4");
}

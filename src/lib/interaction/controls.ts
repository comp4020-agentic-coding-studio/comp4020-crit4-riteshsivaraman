import type { Engine, Mood } from "../audio";
import type { World } from "../sim";

/**
 * The specimen label: mood, drift, level, clear.
 *
 * Four controls is the whole surface. Every one of them changes something
 * the player can hear immediately — a control whose effect is not audible
 * within a second of moving it is a setting, and settings belong in a
 * product, not an instrument.
 *
 * Copy lives here and must match plan.md §2.8: moods are `bright` / `deep`
 * / `open`, never `C major pentatonic`. Nobody needs theory to pick a
 * feeling, and the theory name would make a stranger think they need to
 * know something before they can play.
 */
export type ControlsRig = { destroy(): void };

export type ControlsDeps = {
  root: HTMLElement;
  world: World;
  engine: Engine;
  onClear(): void;
};

/**
 * Contract:
 *  - changing mood must not stop what is sounding; already-live voices keep
 *    their pitch and new ones use the new scale. Cutting everything off
 *    makes the control feel like a mode switch rather than a colour change.
 *  - every control is a real focusable element with a visible focus ring
 *  - `clear` fades; it never hard-stops. Silence arriving instantly reads
 *    as a crash.
 */
export function attachControls(_deps: ControlsDeps): ControlsRig {
  throw new Error("not implemented — see plan.md Issue 6");
}

export type ControlState = {
  mood: Mood;
  drift: number;
  level: number;
};

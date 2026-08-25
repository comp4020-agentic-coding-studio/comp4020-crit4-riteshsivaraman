import type { Engine, Mood } from "../audio";
import type { World, WorldParams } from "../sim";

/**
 * The specimen label: mood, drift, level, clear — always visible — plus
 * five culture conditions (Issue 13) behind a closed `<details>` so the
 * default view stays as sparse as plan.md §2.4 draws it.
 *
 * Every one of them changes something the player can hear or see
 * immediately — a control whose effect is not audible within a second of
 * moving it is a setting, and settings belong in a product, not an
 * instrument. The five conditions are petri-dish language (fertility,
 * vigour, viscosity, bounce, chatter), not preferences, which is what
 * keeps them the right side of that line.
 *
 * Copy lives here and must match plan.md §2.8: moods are evocative names
 * (`bright`, `deep`, `open`, `warm`, `night`, `glass`, `sour`), never
 * theory (`C major pentatonic`). Nobody needs theory to pick a feeling,
 * and the theory name would make a stranger think they need to know
 * something before they can play.
 */
const PARAM_NAMES: (keyof WorldParams)[] = [
  "fertility",
  "vigour",
  "viscosity",
  "bounce",
  "chatter",
];
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
export function attachControls(deps: ControlsDeps): ControlsRig {
  const { root, world, engine, onClear } = deps;

  const moodSelect = root.querySelector<HTMLSelectElement>('[data-control="mood"]');
  const drift = root.querySelector<HTMLInputElement>('[data-control="drift"]');
  const level = root.querySelector<HTMLInputElement>('[data-control="level"]');
  const clear = root.querySelector<HTMLButtonElement>('[data-control="clear"]');

  // engine.setMood swaps the scale for future notes only — it never
  // touches a voice already playing, so a mood change reads as a colour
  // shift rather than a cut. Living organisms keep their integer degree
  // and are simply re-voiced under the new scale next time they collide.
  function onMoodChange(): void {
    if (!moodSelect) return;
    engine.setMood(moodSelect.value as Mood);
  }
  moodSelect?.addEventListener("change", onMoodChange);

  function onDriftInput(): void {
    if (!drift) return;
    world.setDrift(Number(drift.value));
  }
  drift?.addEventListener("input", onDriftInput);

  function onLevelInput(): void {
    if (!level) return;
    engine.setLevel(Number(level.value));
  }
  level?.addEventListener("input", onLevelInput);

  // Never hard-stops: onClear is the caller's job (releaseAll ramps every
  // voice down, world.clear() empties the plate) — this control just asks.
  function onClearClick(): void {
    onClear();
  }
  clear?.addEventListener("click", onClearClick);

  // The five culture conditions: one generic handler reading data-control
  // rather than five copy-pasted blocks. Each just forwards its 0..1 value
  // straight to world.setParam — world.ts owns what each knob means.
  const paramListeners: (() => void)[] = [];
  for (const name of PARAM_NAMES) {
    const el = root.querySelector<HTMLInputElement>(`[data-control="${name}"]`);
    if (!el) continue;
    const onInput = () => world.setParam(name, Number(el.value));
    el.addEventListener("input", onInput);
    paramListeners.push(() => el.removeEventListener("input", onInput));
  }

  return {
    destroy(): void {
      moodSelect?.removeEventListener("change", onMoodChange);
      drift?.removeEventListener("input", onDriftInput);
      level?.removeEventListener("input", onLevelInput);
      clear?.removeEventListener("click", onClearClick);
      for (const removeListener of paramListeners) removeListener();
    },
  };
}

export type ControlState = {
  mood: Mood;
  drift: number;
  level: number;
} & WorldParams;

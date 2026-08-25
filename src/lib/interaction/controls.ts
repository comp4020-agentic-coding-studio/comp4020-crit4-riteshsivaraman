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
export function attachControls(deps: ControlsDeps): ControlsRig {
  const { root, world, engine, onClear } = deps;

  const moodGroup = root.querySelector<HTMLElement>('[data-control="mood"]');
  const moodButtons = moodGroup ? [...moodGroup.querySelectorAll<HTMLButtonElement>("button[data-mood]")] : [];
  const drift = root.querySelector<HTMLInputElement>('[data-control="drift"]');
  const level = root.querySelector<HTMLInputElement>('[data-control="level"]');
  const clear = root.querySelector<HTMLButtonElement>('[data-control="clear"]');

  // engine.setMood swaps the scale for future notes only — it never
  // touches a voice already playing, so a mood change reads as a colour
  // shift rather than a cut.
  function onMoodClick(event: MouseEvent): void {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-mood]");
    if (!button) return;
    const mood = button.dataset.mood as Mood;
    engine.setMood(mood);
    for (const b of moodButtons) b.setAttribute("aria-pressed", String(b === button));
  }
  moodGroup?.addEventListener("click", onMoodClick);

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

  return {
    destroy(): void {
      moodGroup?.removeEventListener("click", onMoodClick);
      drift?.removeEventListener("input", onDriftInput);
      level?.removeEventListener("input", onLevelInput);
      clear?.removeEventListener("click", onClearClick);
    },
  };
}

export type ControlState = {
  mood: Mood;
  drift: number;
  level: number;
};

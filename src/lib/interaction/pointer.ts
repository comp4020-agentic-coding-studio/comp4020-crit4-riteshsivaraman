import { HOLD_NOTE_DECAY, HOLD_NOTE_LEVEL, HOLD_THRESHOLD_MS } from "../constants";
import { freq } from "../audio";
import type { Engine, HeldVoice } from "../audio";
import { degreeFromY, genomeFromGesture } from "../genetics";
import type { Organism, World } from "../sim";

/**
 * The gesture grammar: tap · hold-drag · grab-drag. This is the module the
 * crit actually judges — a pod plays it cold, and latency and feel are the
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
 *
 * Hold used to accumulate a bursting cluster of "buds"; it now just drags
 * the one orb you placed. A tap spawns and plays as before; hold for
 * `HOLD_THRESHOLD_MS` and the same organism goes pointer-driven, droning
 * and retuning as you drag it — the cell you leave behind sounds the note
 * the drone ended on. Grabbing an *existing* organism drones the same way,
 * but never rewrites its genome: heritable state doesn't mutate on a drag.
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
};

const panFromX = (xNorm: number): number => Math.max(-1, Math.min(1, xNorm * 2 - 1));
const brightnessFromX = (xNorm: number): number => Math.max(0, Math.min(1, xNorm));

type Gesture = {
  lastXNorm: number;
  lastYNorm: number;
  holdTimer: ReturnType<typeof setTimeout> | null;
  heldVoice: HeldVoice | null;
  /** The organism this gesture drags once a hold/grab is live. `held` is
   *  set on the organism itself so physics treats it as pointer-driven and
   *  skips it in `integrate`/`bounceWalls` (see sim/physics.ts). Null
   *  before a fresh tap's hold timer fires. */
  dragging: Organism | null;
  /** True when `dragging` is the organism this same gesture just spawned:
   *  its `genome.degree` is rewritten live from the pointer as it drags, so
   *  the cell left behind sounds the note the drone ended on. False when
   *  dragging a pre-existing organism — its genome is heritable state and a
   *  drag is not a mutation, so it drones without retuning. */
  retunes: boolean;
  /** ms timestamp of the last pointermove while dragging, for the
   *  instantaneous-velocity estimate that becomes the release fling. */
  lastDragMoveAt: number;
};

/** Nearest organism whose radius contains (x, y), preferring the closest
 *  centre when discs overlap. Skips organisms already being dragged by
 *  another pointer. Linear scan — population is capped at MAX_POPULATION
 *  (220), cheap next to the physics step already run every frame. */
function hitTest(world: World, x: number, y: number): Organism | null {
  let best: Organism | null = null;
  let bestDistSq = Infinity;
  for (const o of world.organisms) {
    if (o.held) continue;
    const dx = o.x - x;
    const dy = o.y - y;
    const distSq = dx * dx + dy * dy;
    if (distSq <= o.radius * o.radius && distSq < bestDistSq) {
      best = o;
      bestDistSq = distSq;
    }
  }
  return best;
}

/**
 * Wire up pointer input.
 *
 * Implementation notes that are contract, not suggestion:
 *  - Pointer Events only. `setPointerCapture` on pointerdown so a drag that
 *    leaves the canvas still tracks.
 *  - `touch-action: none` on the canvas (set in CSS, not here) or mobile
 *    scroll will eat every drag.
 *  - Tap sounds and spawns synchronously on pointerdown, before the hold
 *    timer is even set. Nothing about a hold changes that first note.
 *  - Moving during a hold/grab updates the held voice's degree — that is
 *    the glide, and it is the most expressive thing in the instrument.
 */
export function attachPointer(deps: PointerDeps): PointerRig {
  const { canvas, world, engine, onFirstGesture } = deps;
  const rng = Math.random;
  const gestures = new Map<number, Gesture>();

  /** Start the sustained voice for a hold/grab and mark `organism` as
   *  pointer-driven. Shared by the tap-then-hold path (delayed by
   *  HOLD_THRESHOLD_MS) and the grab-an-existing-organism path
   *  (immediate — a grab is already a drag, there is nothing to wait on). */
  function beginDrag(g: Gesture, organism: Organism, retunes: boolean): void {
    organism.held = true;
    g.dragging = organism;
    g.retunes = retunes;
    g.lastDragMoveAt = performance.now();
    g.heldVoice = engine.hold({
      degree: organism.genome.degree,
      level: HOLD_NOTE_LEVEL,
      brightness: brightnessFromX(g.lastXNorm),
      decay: HOLD_NOTE_DECAY,
      pan: panFromX(g.lastXNorm),
    });
  }

  /** Stop the hold timer, the held voice, and any drag. Every path out of a
   *  hold or a drag comes through here — a stuck drone and a stuck drag are
   *  the same class of bug. Leaves `vx`/`vy` on the organism as the last
   *  pointer-velocity estimate — that's the fling. */
  function teardown(id: number): void {
    const g = gestures.get(id);
    if (!g) return;
    gestures.delete(id);
    if (g.holdTimer !== null) clearTimeout(g.holdTimer);
    if (g.heldVoice) g.heldVoice.release();
    if (g.dragging) g.dragging.held = false;
  }

  function releaseAllHeld(): void {
    for (const id of [...gestures.keys()]) teardown(id);
  }

  function onPointerDown(event: PointerEvent): void {
    onFirstGesture();
    void engine.resume();
    canvas.setPointerCapture(event.pointerId);

    const { xNorm, yNorm } = normalisePoint(canvas, event);
    const x = xNorm * world.width;
    const y = yNorm * world.height;

    const hit = hitTest(world, x, y);
    if (hit) {
      // Grab an existing cell instead of seeding a new one: no tap sound,
      // no spawn. It drones immediately (a grab is already a drag), seeded
      // from its own genome.degree, but never rewrites that genome —
      // heritable state doesn't mutate on a drag.
      const gesture: Gesture = {
        lastXNorm: xNorm,
        lastYNorm: yNorm,
        holdTimer: null,
        heldVoice: null,
        dragging: null,
        retunes: false,
        lastDragMoveAt: event.timeStamp,
      };
      gestures.set(event.pointerId, gesture);
      beginDrag(gesture, hit, false);
      return;
    }

    // The tap: sounds and spawns right here, synchronously, before the
    // hold timer is even set. See the file header rule.
    const genome = genomeFromGesture(xNorm, yNorm, rng);
    engine.play({
      degree: degreeFromY(yNorm),
      level: genome.size,
      brightness: brightnessFromX(xNorm),
      decay: genome.decay,
      pan: panFromX(xNorm),
    });
    const organism = world.spawn(genome, x, y);

    const gesture: Gesture = {
      lastXNorm: xNorm,
      lastYNorm: yNorm,
      holdTimer: null,
      heldVoice: null,
      dragging: null,
      retunes: false,
      lastDragMoveAt: event.timeStamp,
    };
    if (organism) {
      gesture.holdTimer = setTimeout(() => {
        gesture.holdTimer = null;
        beginDrag(gesture, organism, true);
      }, HOLD_THRESHOLD_MS);
    }
    gestures.set(event.pointerId, gesture);
  }

  function onPointerMove(event: PointerEvent): void {
    const g = gestures.get(event.pointerId);
    if (!g) return;

    const { xNorm, yNorm } = normalisePoint(canvas, event);
    g.lastXNorm = xNorm;
    g.lastYNorm = yNorm;

    if (!g.dragging) return;
    const o = g.dragging;

    const dtS = Math.max((event.timeStamp - g.lastDragMoveAt) / 1000, 1 / 1000);
    g.lastDragMoveAt = event.timeStamp;

    const targetX = Math.min(Math.max(xNorm * world.width, o.radius), world.width - o.radius);
    const targetY = Math.min(Math.max(yNorm * world.height, o.radius), world.height - o.radius);
    // Instantaneous pointer velocity, not a smoothed average — a fast
    // swipe should feel exactly as fast as it looks, and it's also what
    // makes the eventual release fling feel connected to the gesture that
    // produced it.
    o.vx = (targetX - o.x) / dtS;
    o.vy = (targetY - o.y) / dtS;
    o.x = targetX;
    o.y = targetY;

    if (g.retunes) {
      // Retune the orb you just placed: the cell left behind sounds the
      // note the drone ended on, and inkOf(genome) means it visibly shifts
      // colour too. Every other genome field stays as spawned.
      o.genome.degree = degreeFromY(yNorm);
    }

    if (g.heldVoice) {
      g.heldVoice.update({
        frequency: freq(degreeFromY(yNorm), engine.mood),
        pan: panFromX(xNorm),
        brightness: brightnessFromX(xNorm),
      });
    }
  }

  const onPointerUp = (event: PointerEvent) => teardown(event.pointerId);
  const onPointerCancel = (event: PointerEvent) => teardown(event.pointerId);
  const onBlur = () => releaseAllHeld();
  const onVisibility = () => {
    if (document.hidden) releaseAllHeld();
  };

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerCancel);
  window.addEventListener("blur", onBlur);
  document.addEventListener("visibilitychange", onVisibility);

  return {
    destroy() {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibility);
      releaseAllHeld();
    },
  };
}

/** Canvas-relative, normalised 0..1. yNorm 0 is the TOP. */
export function normalisePoint(
  canvas: HTMLCanvasElement,
  event: PointerEvent,
): { xNorm: number; yNorm: number } {
  const rect = canvas.getBoundingClientRect();
  const xNorm = rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0;
  const yNorm = rect.height > 0 ? (event.clientY - rect.top) / rect.height : 0;
  return {
    xNorm: Math.min(1, Math.max(0, xNorm)),
    yNorm: Math.min(1, Math.max(0, yNorm)),
  };
}

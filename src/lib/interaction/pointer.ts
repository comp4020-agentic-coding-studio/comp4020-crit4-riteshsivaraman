import {
  DISPERSAL_SPEED,
  DISPERSAL_SPREAD_RAD,
  HOLD_MAX_CLUSTER,
  HOLD_NOTE_DECAY,
  HOLD_NOTE_LEVEL,
  HOLD_SPAWN_INTERVAL,
  HOLD_THRESHOLD_MS,
  RELEASE_ARPEGGIO_MS,
} from "../constants";
import { freq } from "../audio";
import type { Engine, HeldVoice } from "../audio";
import { degreeFromY, genomeFromGesture } from "../genetics";
import type { Organism, World } from "../sim";

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

const panFromX = (xNorm: number): number => Math.max(-1, Math.min(1, xNorm * 2 - 1));
const brightnessFromX = (xNorm: number): number => Math.max(0, Math.min(1, xNorm));

type Gesture = {
  startXNorm: number;
  startYNorm: number;
  lastXNorm: number;
  lastYNorm: number;
  holdTimer: ReturnType<typeof setTimeout> | null;
  spawnTimer: ReturnType<typeof setInterval> | null;
  heldVoice: HeldVoice | null;
  clusterCount: number;
  holding: boolean;
  /** Set instead of the tap/hold branch when pointerdown lands on an
   *  existing organism: this pointer is dragging it, not seeding a new
   *  one. `held` is set on the organism itself so physics treats it as
   *  pointer-driven (see sim/physics.ts). */
  dragging: Organism | null;
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
 *  - Moving during a hold updates the held voice's degree — that is the
 *    glide, and it is the most expressive thing in the instrument.
 *  - Release disperses along the drag vector, notes staggered by
 *    RELEASE_ARPEGGIO_MS. Stagger rather than stack: a true 12-note stack
 *    eats the whole voice cap and sounds like a cluster, an arpeggio at
 *    38ms reads as a chord and leaves room for the ecosystem underneath.
 */
export function attachPointer(deps: PointerDeps): PointerRig {
  const { canvas, world, engine, onFirstGesture, onChargeChange } = deps;
  const rng = Math.random;
  const gestures = new Map<number, Gesture>();

  function reportCharge(g: Gesture): void {
    onChargeChange({
      x: g.lastXNorm * world.width,
      y: g.lastYNorm * world.height,
      fullness: Math.min(1, g.clusterCount / HOLD_MAX_CLUSTER),
      count: g.clusterCount,
      degree: degreeFromY(g.lastYNorm),
    });
  }

  function beginHold(g: Gesture): void {
    g.holding = true;
    g.heldVoice = engine.hold({
      degree: degreeFromY(g.lastYNorm),
      level: HOLD_NOTE_LEVEL,
      brightness: brightnessFromX(g.lastXNorm),
      decay: HOLD_NOTE_DECAY,
      pan: panFromX(g.lastXNorm),
    });
    reportCharge(g);
    g.spawnTimer = setInterval(() => {
      if (g.clusterCount >= HOLD_MAX_CLUSTER) return;
      g.clusterCount++;
      reportCharge(g);
    }, HOLD_SPAWN_INTERVAL);
  }

  /** Stop timers, the held voice, and any drag; leaves cluster data on `g`
   *  intact for `disperse` to read. Every path out of a hold or a drag
   *  comes through here — a stuck drone and a stuck drag are the same
   *  class of bug. */
  function teardown(id: number): Gesture | undefined {
    const g = gestures.get(id);
    if (!g) return undefined;
    gestures.delete(id);
    if (g.holdTimer !== null) clearTimeout(g.holdTimer);
    if (g.spawnTimer !== null) clearInterval(g.spawnTimer);
    if (g.heldVoice) {
      g.heldVoice.release();
      onChargeChange(null);
    }
    if (g.dragging) {
      // Leave vx/vy as the last pointer-velocity estimate — that's the
      // fling — and only now let physics drive the organism again.
      g.dragging.held = false;
    }
    return g;
  }

  function disperse(g: Gesture): void {
    if (g.clusterCount === 0) return;

    // Evenly spaced around the full circle (plus jitter) rather than a
    // narrow cone along the drag vector — the packed cluster is a ball of
    // buds sitting on top of each other, and release should read as that
    // ball bursting outward in every direction, not the whole thing
    // flying off one way.
    const baseAngle = rng() * Math.PI * 2;

    const originX = g.lastXNorm * world.width;
    const originY = g.lastYNorm * world.height;
    const pan = panFromX(g.lastXNorm);
    const brightness = brightnessFromX(g.lastXNorm);

    for (let i = 0; i < g.clusterCount; i++) {
      const angle =
        baseAngle + (i / g.clusterCount) * Math.PI * 2 + (rng() - 0.5) * DISPERSAL_SPREAD_RAD;
      const genome = genomeFromGesture(g.lastXNorm, g.lastYNorm, rng);
      const vx = Math.cos(angle) * DISPERSAL_SPEED;
      const vy = Math.sin(angle) * DISPERSAL_SPEED;
      const organism = world.spawn(genome, originX, originY, { vx, vy });
      if (!organism) continue;

      setTimeout(() => {
        engine.play({
          degree: genome.degree,
          level: genome.size,
          brightness,
          decay: genome.decay,
          pan,
        });
      }, i * RELEASE_ARPEGGIO_MS);
    }
  }

  function endGesture(event: PointerEvent): void {
    const torn = teardown(event.pointerId);
    if (torn?.holding) disperse(torn);
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
      // no spawn. Physics (sim/physics.ts) treats `held` organisms as
      // pointer-driven and infinite-mass, so it still bumps and sounds
      // against everything else while dragged.
      hit.held = true;
      const gesture: Gesture = {
        startXNorm: xNorm,
        startYNorm: yNorm,
        lastXNorm: xNorm,
        lastYNorm: yNorm,
        holdTimer: null,
        spawnTimer: null,
        heldVoice: null,
        clusterCount: 0,
        holding: false,
        dragging: hit,
        lastDragMoveAt: event.timeStamp,
      };
      gestures.set(event.pointerId, gesture);
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
    world.spawn(genome, x, y);

    const gesture: Gesture = {
      startXNorm: xNorm,
      startYNorm: yNorm,
      lastXNorm: xNorm,
      lastYNorm: yNorm,
      holdTimer: null,
      spawnTimer: null,
      heldVoice: null,
      clusterCount: 0,
      holding: false,
      dragging: null,
      lastDragMoveAt: event.timeStamp,
    };
    gesture.holdTimer = setTimeout(() => {
      gesture.holdTimer = null;
      beginHold(gesture);
    }, HOLD_THRESHOLD_MS);
    gestures.set(event.pointerId, gesture);
  }

  function onPointerMove(event: PointerEvent): void {
    const g = gestures.get(event.pointerId);
    if (!g) return;

    const { xNorm, yNorm } = normalisePoint(canvas, event);
    g.lastXNorm = xNorm;
    g.lastYNorm = yNorm;

    if (g.dragging) {
      const o = g.dragging;
      const dtS = Math.max((event.timeStamp - g.lastDragMoveAt) / 1000, 1 / 1000);
      g.lastDragMoveAt = event.timeStamp;

      const targetX = Math.min(Math.max(xNorm * world.width, o.radius), world.width - o.radius);
      const targetY = Math.min(Math.max(yNorm * world.height, o.radius), world.height - o.radius);
      // Instantaneous pointer velocity, not a smoothed average — a fast
      // swipe into a cluster should feel exactly as fast as it looks, and
      // it's also what makes the eventual release fling feel connected to
      // the gesture that produced it.
      o.vx = (targetX - o.x) / dtS;
      o.vy = (targetY - o.y) / dtS;
      o.x = targetX;
      o.y = targetY;
      return;
    }

    if (g.holding && g.heldVoice) {
      g.heldVoice.update({
        frequency: freq(degreeFromY(yNorm), engine.mood),
        pan: panFromX(xNorm),
        brightness: brightnessFromX(xNorm),
      });
      reportCharge(g);
    }
  }

  function releaseAllHeld(): void {
    for (const id of [...gestures.keys()]) teardown(id);
  }

  const onPointerUp = (event: PointerEvent) => endGesture(event);
  const onPointerCancel = (event: PointerEvent) => endGesture(event);
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

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

  /** Stop timers and the held voice; leaves cluster/drag data on `g` intact
   *  for `disperse` to read. Every path out of a hold comes through here. */
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
    return g;
  }

  function disperse(g: Gesture): void {
    if (g.clusterCount === 0) return;

    const dx = g.lastXNorm - g.startXNorm;
    const dy = g.lastYNorm - g.startYNorm;
    const dragMag = Math.hypot(dx, dy);
    const baseAngle = dragMag < 1e-4 ? rng() * Math.PI * 2 : Math.atan2(dy, dx);

    const originX = g.lastXNorm * world.width;
    const originY = g.lastYNorm * world.height;
    const pan = panFromX(g.lastXNorm);
    const brightness = brightnessFromX(g.lastXNorm);

    for (let i = 0; i < g.clusterCount; i++) {
      const angle = baseAngle + (rng() - 0.5) * DISPERSAL_SPREAD_RAD;
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
    const g = teardown(event.pointerId);
    if (g?.holding) disperse(g);
  }

  function onPointerDown(event: PointerEvent): void {
    onFirstGesture();
    void engine.resume();
    canvas.setPointerCapture(event.pointerId);

    const { xNorm, yNorm } = normalisePoint(canvas, event);
    const genome = genomeFromGesture(xNorm, yNorm, rng);

    // Tap sounds immediately, in this handler — do not wait for the sim.
    engine.play({
      degree: degreeFromY(yNorm),
      level: genome.size,
      brightness: brightnessFromX(xNorm),
      decay: genome.decay,
      pan: panFromX(xNorm),
    });
    world.spawn(genome, xNorm * world.width, yNorm * world.height);

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

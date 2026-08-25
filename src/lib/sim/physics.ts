/**
 * Integration and collision resolution. REFERENCE IMPLEMENTATION — working
 * code, not a stub. Read it before you change it.
 *
 * Written out because the failure modes here are all *plausible-looking*.
 * Resolving a collision by simply swapping or negating velocities looks
 * right on two equal circles and is wrong the moment masses differ. Moving
 * circles apart without a separate positional correction lets them sink
 * into each other and then vibrate, which sounds like a machine gun once
 * every overlap is a note. Applying the impulse when the pair is already
 * separating makes them stick together and hum. Each of those produces a
 * canvas that looks broadly plausible and sounds wrong, and "sounds wrong"
 * is the one thing no check in this repo can detect.
 *
 * The maths is standard impulse-based resolution for two circles:
 *
 *   n     = normalised vector from a to b
 *   vRel  = (vb - va) · n            ← negative means approaching
 *   j     = -(1 + e) · vRel / (1/ma + 1/mb)
 *   va   -= (j / ma) · n
 *   vb   += (j / mb) · n
 */

import { POSITIONAL_CORRECTION, RADIUS_RANGE, RESTITUTION_RANGE } from "../constants";
import type { Organism } from "./types";

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const radiusOf = (size: number) => lerp(RADIUS_RANGE[0], RADIUS_RANGE[1], size);
/** Area-proportional. A cell twice the radius is four times as hard to shove. */
export const massOf = (radius: number) => (radius * radius) / 100;
/** `scale` is the live BOUNCE_RESTITUTION_SCALE_RANGE multiplier (Issue 13,
 *  WorldParams.bounce); defaults to 1 so every existing caller is unchanged. */
export const restitutionOf = (bounce: number, scale = 1) =>
  lerp(RESTITUTION_RANGE[0], RESTITUTION_RANGE[1], bounce) * scale;

/** One substep of motion for one organism. Call with FIXED_DT.
 *  A held (dragged) organism has its x/y driven by the pointer, not by
 *  velocity — skip the motion update, but life/age keep ticking.
 *  `drag` is the live VISCOSITY_DRAG_RANGE value (Issue 13, WorldParams.viscosity). */
export function integrate(o: Organism, dt: number, drag: number): void {
  if (!o.held) {
    o.x += o.vx * dt;
    o.y += o.vy * dt;
    o.vx *= drag;
    o.vy *= drag;
  }
  o.age += dt;
  o.life -= dt;
}

/**
 * Bounce off the walls. Position is corrected as well as velocity —
 * reflecting velocity alone leaves the cell outside the box for a frame,
 * and if it is still outside next frame it reflects again and sticks to
 * the wall buzzing.
 *
 * Skipped for a held organism: the pointer that's dragging it is expected
 * to stay clamped to the canvas, so walls have nothing to correct, and a
 * wall bounce would stomp the fling velocity the drag is building up.
 *
 * `wallRestitution` is the live BOUNCE_WALL_RANGE value (Issue 13,
 * WorldParams.bounce).
 */
export function bounceWalls(
  o: Organism,
  width: number,
  height: number,
  wallRestitution: number,
): void {
  if (o.held) return;
  if (o.x - o.radius < 0) {
    o.x = o.radius;
    o.vx = Math.abs(o.vx) * wallRestitution;
  } else if (o.x + o.radius > width) {
    o.x = width - o.radius;
    o.vx = -Math.abs(o.vx) * wallRestitution;
  }
  if (o.y - o.radius < 0) {
    o.y = o.radius;
    o.vy = Math.abs(o.vy) * wallRestitution;
  } else if (o.y + o.radius > height) {
    o.y = height - o.radius;
    o.vy = -Math.abs(o.vy) * wallRestitution;
  }
}

export type Contact = {
  /** Approach speed along the normal, px/s. Always >= 0. */
  speed: number;
  /** Contact point. */
  x: number;
  y: number;
};

/**
 * Resolve a pair if they overlap. Returns the contact if they were
 * *approaching*, otherwise null.
 *
 * Returning null for a separating pair is not an optimisation — it is the
 * fix for the sticking bug. Two circles can still overlap on the frame
 * after they have been pushed apart; applying a second impulse then cancels
 * the first and they stay glued, humming.
 */
export function resolvePair(a: Organism, b: Organism): Contact | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const distSq = dx * dx + dy * dy;
  const minDist = a.radius + b.radius;
  if (distSq >= minDist * minDist) return null;

  // Exactly coincident centres give no normal. Nudge deterministically
  // rather than randomly, so a replayed simulation stays identical.
  let dist = Math.sqrt(distSq);
  let nx: number;
  let ny: number;
  if (dist < 1e-6) {
    dist = 1e-6;
    nx = 1;
    ny = 0;
  } else {
    nx = dx / dist;
    ny = dy / dist;
  }

  const rvx = b.vx - a.vx;
  const rvy = b.vy - a.vy;
  const approach = rvx * nx + rvy * ny;

  // A held organism is pointer-driven, not physics-driven: treat it as
  // infinite mass so it deflects the other side without moving itself.
  // If both are held (e.g. a two-finger drag), there's no invertible mass
  // to resolve against — skip position/impulse but still let the contact
  // through so it can sound.
  const invA = a.held ? 0 : 1 / a.mass;
  const invB = b.held ? 0 : 1 / b.mass;
  const invSum = invA + invB;

  if (invSum > 0) {
    // Positional correction happens even for a separating pair — that is
    // how a pile untangles instead of compressing.
    const overlap = minDist - dist;
    const push = (overlap * POSITIONAL_CORRECTION) / invSum;
    a.x -= nx * push * invA;
    a.y -= ny * push * invA;
    b.x += nx * push * invB;
    b.y += ny * push * invB;
  }

  if (approach >= 0) return null; // separating: no impulse, no sound

  if (invSum === 0) {
    return { speed: -approach, x: a.x + nx * a.radius, y: a.y + ny * a.radius };
  }

  const e = Math.min(a.restitution, b.restitution);
  const j = (-(1 + e) * approach) / invSum;
  a.vx -= j * invA * nx;
  a.vy -= j * invA * ny;
  b.vx += j * invB * nx;
  b.vy += j * invB * ny;

  return {
    speed: -approach,
    x: a.x + nx * a.radius,
    y: a.y + ny * a.radius,
  };
}

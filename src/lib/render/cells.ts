import {
  BUD_GROW_MS,
  BUD_PACK_ITERATIONS,
  BUD_PULSE_AMPLITUDE,
  BUD_PULSE_HZ,
  BUD_RADIUS,
  CELL_ALPHA,
  FADE_SECONDS,
  NUCLEUS_DARKEN,
  PULSE_AMPLITUDE,
  PULSE_RATE_RANGE,
} from "../constants";
import { inkOf, INK_ORDER, SCALE_SPAN, type Ink } from "../genetics";
import type { Organism } from "../sim";
import type { InkLayers } from "./layers";

const NUCLEUS_FRACTION = 0.45;

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Golden-angle desync so 200 cells sharing a pulse formula don't beat in
 *  sync — each organism's phase comes from its own id, not from time. */
function pulsePhase(id: number): number {
  return (id * 2.399963) % (Math.PI * 2);
}

/** 1 at full life, shrinking to 0 over the last FADE_SECONDS. */
function fadeOf(o: Organism): number {
  if (o.life >= FADE_SECONDS) return 1;
  return Math.max(0, o.life / FADE_SECONDS);
}

function pulseOf(o: Organism, timeMs: number): number {
  const hz = lerp(PULSE_RATE_RANGE[0], PULSE_RATE_RANGE[1], o.genome.speed);
  return 1 + PULSE_AMPLITUDE * Math.sin((timeMs / 1000) * hz * Math.PI * 2 + pulsePhase(o.id));
}

/** One organism, into the context already set up for a single ink
 *  channel: flat fill colour is fixed, alpha carries the channel weight. */
function drawCellIntoChannel(
  ctx: CanvasRenderingContext2D,
  o: Organism,
  weight: number,
  radius: number,
): void {
  if (weight <= 0) return;
  ctx.globalAlpha = Math.min(1, weight * CELL_ALPHA);
  ctx.beginPath();
  ctx.arc(o.x, o.y, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = Math.min(1, weight * CELL_ALPHA + NUCLEUS_DARKEN);
  ctx.beginPath();
  ctx.arc(o.x, o.y, radius * NUCLEUS_FRACTION, 0, Math.PI * 2);
  ctx.fill();
}

/** Same disc, one flat colour — the degraded fallback's direct draw. */
function drawCellFlat(
  target: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  radius: number,
): void {
  target.globalAlpha = 1;
  target.fillStyle = color;
  target.beginPath();
  target.arc(x, y, radius, 0, Math.PI * 2);
  target.fill();
}

/**
 * Draw the population into the ink layers.
 *
 * A cell is a filled disc with a slightly denser nucleus at 45% radius and
 * a subtle pulse whose rate comes from `genome.speed`. It is NOT a glowing
 * orb — no shadowBlur, no radial gradient bloom. Ink does not glow, and
 * the moment one cell glows the whole print stops reading as a print.
 *
 * Alpha is capped at CELL_ALPHA so a dense clump multiplies toward a deep
 * overprint rather than straight to black. Density showing as darkness is
 * correct and wanted; density showing as a black hole is not.
 *
 * In degraded mode (`layers.degraded`) there are no offscreen layers left
 * to multiply, so each cell is drawn once, directly onto `target`, with
 * `layers.fallbackColor` approximating the overprint in one flat colour.
 */
export function drawPopulation(
  layers: InkLayers,
  organisms: readonly Organism[],
  timeMs: number,
  target: CanvasRenderingContext2D,
): void {
  if (layers.degraded) {
    target.save();
    target.setTransform(1, 0, 0, 1, 0, 0);
    target.scale(layers.dpr, layers.dpr);
    for (const o of organisms) {
      const fade = fadeOf(o);
      if (fade <= 0) continue;
      const radius = o.radius * fade * pulseOf(o, timeMs);
      drawCellFlat(target, o.x, o.y, layers.fallbackColor(inkOf(o.genome)), radius);
    }
    target.restore();
    return;
  }

  for (const channel of INK_ORDER) {
    layers.paint(channel, (ctx) => {
      for (const o of organisms) {
        const fade = fadeOf(o);
        if (fade <= 0) continue;
        const weight = inkOf(o.genome)[channel];
        const radius = o.radius * fade * pulseOf(o, timeMs);
        drawCellIntoChannel(ctx, o, weight, radius);
      }
    });
  }
}

export type Charge = { x: number; y: number; fullness: number; count: number; degree: number };

/** Charge cluster colour: pink only, at full weight for the degree under
 *  the pointer — there is no full genome yet (size/brightness don't exist
 *  until release), so blue/yellow are left at 0 rather than invented. */
function chargeInk(charge: Charge): Ink {
  return { pink: charge.degree / (SCALE_SPAN - 1), blue: 0, yellow: 0 };
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

/** Position relative to the charge's (x, y), in px — not absolute, since
 *  the whole cluster rides along with the pointer while charging. */
type Bud = { dx: number; dy: number; birthMs: number };

/** Pull every bud a little toward the cluster's centroid, then push apart
 *  any pair closer than touching distance. Interleaving attraction with
 *  repulsion each iteration is what settles the cluster into a tight,
 *  roughly circular ball — like packed nucleons — instead of a random-walk
 *  chain: pure repulsion alone only prevents overlap, it never pulls a
 *  loose cluster back in. Cheap: cluster is capped at HOLD_MAX_CLUSTER
 *  (12), so O(n^2) per addition is nothing. */
function packBuds(buds: Bud[]): void {
  const minDist = BUD_RADIUS * 2;
  const centerPull = 0.12;
  for (let iter = 0; iter < BUD_PACK_ITERATIONS; iter++) {
    let cx = 0;
    let cy = 0;
    for (const b of buds) {
      cx += b.dx;
      cy += b.dy;
    }
    cx /= buds.length;
    cy /= buds.length;
    for (const b of buds) {
      b.dx += (cx - b.dx) * centerPull;
      b.dy += (cy - b.dy) * centerPull;
    }

    for (let i = 0; i < buds.length; i++) {
      for (let j = i + 1; j < buds.length; j++) {
        const dx = buds[j].dx - buds[i].dx;
        const dy = buds[j].dy - buds[i].dy;
        const dist = Math.hypot(dx, dy) || 0.001;
        if (dist >= minDist) continue;
        const push = (minDist - dist) / 2;
        const ux = dx / dist;
        const uy = dy / dist;
        buds[i].dx -= ux * push;
        buds[i].dy -= uy * push;
        buds[j].dx += ux * push;
        buds[j].dy += uy * push;
      }
    }
  }
}

/**
 * Tracks each accumulated offspring as a bud that divides off a randomly
 * chosen existing bud and packs in next to it — mitosis, doubling into an
 * irregular clump (see reference: cancer cell doubling), not one big
 * nucleus with satellites orbiting it. State is a session singleton: only
 * one charge gesture is drawn at a time (see `Charge`'s call site), so
 * there is nothing to key it by. A fresh gesture always starts at
 * `count === 0`, which is strictly less than whatever `lastCount` a prior
 * session left behind, so the drop-in-count check below is enough to
 * reset — no separate "gesture ended" hook needed.
 */
function createBudAnimator(): (charge: Charge, timeMs: number) => readonly Bud[] {
  let buds: Bud[] = [];
  let lastCount = -1;
  return (charge, timeMs) => {
    if (charge.count < lastCount) {
      buds = [];
      lastCount = -1;
    }
    while (lastCount < charge.count) {
      if (buds.length === 0) {
        buds.push({ dx: 0, dy: 0, birthMs: timeMs });
      } else {
        const anchor = buds[Math.floor(Math.random() * buds.length)];
        const angle = Math.random() * Math.PI * 2;
        buds.push({
          dx: anchor.dx + Math.cos(angle) * BUD_RADIUS * 2,
          dy: anchor.dy + Math.sin(angle) * BUD_RADIUS * 2,
          birthMs: timeMs,
        });
        packBuds(buds);
      }
      lastCount++;
    }
    return buds;
  };
}

const nextChargeBuds = createBudAnimator();

/** Golden-angle desync per bud, same trick as `pulsePhase`, keyed on the
 *  bud's packed offset since buds have no stable id. */
function budPulsePhase(bud: Bud): number {
  return ((bud.dx + bud.dy) * 12.9898) % (Math.PI * 2);
}

function drawBuds(ctx: CanvasRenderingContext2D, charge: Charge, timeMs: number, weight: number): void {
  ctx.globalAlpha = Math.min(1, weight * CELL_ALPHA);
  for (const bud of nextChargeBuds(charge, timeMs)) {
    const t = Math.max(0, Math.min(1, (timeMs - bud.birthMs) / BUD_GROW_MS));
    const eased = easeOutCubic(t);
    const pulse =
      t >= 1
        ? 1 + BUD_PULSE_AMPLITUDE * Math.sin((timeMs / 1000) * BUD_PULSE_HZ * Math.PI * 2 + budPulsePhase(bud))
        : 1;
    const radius = eased * BUD_RADIUS * pulse;
    ctx.beginPath();
    ctx.arc(charge.x + bud.dx, charge.y + bud.dy, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * The charging cluster: equal-sized buds that divide and pack together
 * into an irregular clump, one per accumulated offspring — mitosis, not a
 * single growing nucleus (see `drawBuds`). Drawn on top of the population,
 * in the ink of the degree currently under the pointer, so the player can
 * see the pitch they are about to release.
 */
export function drawCharge(
  layers: InkLayers,
  charge: Charge,
  timeMs: number,
  target: CanvasRenderingContext2D,
): void {
  const weight = chargeInk(charge).pink;

  if (layers.degraded) {
    target.save();
    target.setTransform(1, 0, 0, 1, 0, 0);
    target.scale(layers.dpr, layers.dpr);
    target.fillStyle = layers.fallbackColor(chargeInk(charge));
    drawBuds(target, charge, timeMs, weight);
    target.restore();
    return;
  }

  layers.paint("pink", (ctx) => {
    drawBuds(ctx, charge, timeMs, weight);
  });
}

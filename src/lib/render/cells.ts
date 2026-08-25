import { CELL_ALPHA, FADE_SECONDS, NUCLEUS_DARKEN, PULSE_AMPLITUDE, PULSE_RATE_RANGE } from "../constants";
import { inkOf, INK_ORDER } from "../genetics";
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


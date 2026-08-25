import {
  CELL_ALPHA,
  FPS_FALLBACK_MS,
  FPS_FALLBACK_THRESHOLD,
  JOLT_DECAY_MS,
  REGISTER_LOAD_DISTANCE_PX,
  REGISTER_LOAD_DURATION_MS,
  REGISTER_LOAD_STAGGER_MS,
  REGISTRATION,
  JOLT_SCALE,
  type InkChannel,
} from "../constants";
import { INK_ORDER, type Ink } from "../genetics";

/**
 * Three offscreen ink layers, composited onto paper with `multiply` and a
 * small registration offset. This is the signature (plan.md §2.5): the
 * print is always slightly out of register, and on a collision it jolts.
 *
 * Why offscreen layers rather than drawing each cell three times directly:
 * real printing offsets a whole PLATE, not individual marks. Per-cell
 * offsets look like a chromatic-aberration filter; per-layer offsets look
 * like a misregistered print. It is also fewer state changes — three
 * composites a frame instead of six hundred.
 */
export type InkLayers = {
  /** Draw into one channel. The callback gets a context already set up
   *  with the right composite mode and the channel's flat ink colour. */
  paint(channel: InkChannel, draw: (ctx: CanvasRenderingContext2D) => void): void;
  /** Clear all three layers. Once per frame, before painting. */
  clear(): void;
  /**
   * Composite the three layers onto the visible canvas over paper stock.
   * `jolt` is 0..1 and scales the registration offsets by
   * `1 + jolt * JOLT_SCALE`.
   *
   * In degraded mode this only paints paper — the caller draws cells
   * directly onto `target` afterwards (see `fallbackColor`, `dpr`).
   */
  composite(target: CanvasRenderingContext2D, jolt: number): void;
  /** Fill `target` with paper stock only. What `composite` does before the
   *  ink layers; exposed so the degraded path can paint paper without
   *  going through the (unused, in that mode) layer machinery. */
  paintPaper(target: CanvasRenderingContext2D): void;
  /** Approximate a cell's {pink, blue, yellow} weights as one flat colour
   *  by simulating the multiply-onto-paper composite in RGB. Used only by
   *  the degraded fallback, which has no offscreen layers left to
   *  multiply for real. */
  fallbackColor(weights: Ink): string;
  resize(width: number, height: number, dpr: number): void;
  /** True when the FPS fallback has collapsed to single-layer drawing.
   *  One-way for the session: once true, stays true. */
  readonly degraded: boolean;
  /** Device pixel ratio this instance was (re)sized with. The degraded
   *  path needs it to scale its own direct drawing onto `target`. */
  readonly dpr: number;
  /** Called by the loop with the frame time; may flip `degraded`. */
  sample(frameMs: number): void;
  /**
   * Page-load registration animation (§2.6): the three layers slide into
   * register from ~14px out, staggered, easing in over ~520ms. No-ops
   * under `prefers-reduced-motion`, calling `onDone` immediately instead.
   */
  playLoadAnimation(onDone?: () => void): void;
};

type Ctx2D = CanvasRenderingContext2D;

type LayerCanvas = {
  canvas: OffscreenCanvas | HTMLCanvasElement;
  ctx: Ctx2D;
};

type InkPalette = { paper: string; pink: string; blue: string; yellow: string };

function reducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function resolveInkPalette(): InkPalette {
  const style = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string): string => {
    const value = style.getPropertyValue(name).trim();
    return value.length > 0 ? value : fallback;
  };
  return {
    paper: read("--paper", "#efeae0"),
    pink: read("--ink-pink", "#ff48b0"),
    blue: read("--ink-blue", "#0078bf"),
    yellow: read("--ink-yellow", "#ffe800"),
  };
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3
    ? h.split("").map((c) => c + c).join("")
    : h;
  const n = Number.parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Multiply `[r,g,b]` by `hex`, per channel, 0..255 in, 0..255 out. */
function multiplyChannel(rgb: readonly [number, number, number], hex: string): [number, number, number] {
  const [cr, cg, cb] = hexToRgb(hex);
  return [(rgb[0] * cr) / 255, (rgb[1] * cg) / 255, (rgb[2] * cb) / 255];
}

function unit(v: readonly [number, number]): [number, number] {
  const len = Math.hypot(v[0], v[1]) || 1;
  return [v[0] / len, v[1] / len];
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function createLayerCanvas(deviceWidth: number, deviceHeight: number, dpr: number): LayerCanvas {
  let canvas: OffscreenCanvas | HTMLCanvasElement;
  if (typeof OffscreenCanvas !== "undefined") {
    canvas = new OffscreenCanvas(deviceWidth, deviceHeight);
  } else {
    const el = document.createElement("canvas");
    el.width = deviceWidth;
    el.height = deviceHeight;
    canvas = el;
  }
  const ctx = canvas.getContext("2d") as unknown as Ctx2D;
  ctx.scale(dpr, dpr);
  return { canvas, ctx };
}

class LayersImpl implements InkLayers {
  private layers: Record<InkChannel, LayerCanvas>;
  private palette: InkPalette;
  private width: number;
  private height: number;
  private dprValue: number;
  private degradedValue = false;
  private badMs = 0;
  private loadStart: number | null = null;
  private loadOnDone: (() => void) | undefined;
  private loadDone = false;

  constructor(width: number, height: number, dpr: number) {
    this.width = width;
    this.height = height;
    this.dprValue = dpr;
    this.palette = resolveInkPalette();
    this.layers = this.createLayers();
  }

  private createLayers(): Record<InkChannel, LayerCanvas> {
    const deviceWidth = this.width * this.dprValue;
    const deviceHeight = this.height * this.dprValue;
    return {
      pink: createLayerCanvas(deviceWidth, deviceHeight, this.dprValue),
      blue: createLayerCanvas(deviceWidth, deviceHeight, this.dprValue),
      yellow: createLayerCanvas(deviceWidth, deviceHeight, this.dprValue),
    };
  }

  get degraded(): boolean {
    return this.degradedValue;
  }

  get dpr(): number {
    return this.dprValue;
  }

  paint(channel: InkChannel, draw: (ctx: Ctx2D) => void): void {
    const { ctx } = this.layers[channel];
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = this.palette[channel];
    ctx.strokeStyle = this.palette[channel];
    draw(ctx);
    ctx.restore();
  }

  clear(): void {
    for (const channel of INK_ORDER) {
      const { ctx } = this.layers[channel];
      ctx.clearRect(0, 0, this.width, this.height);
    }
  }

  paintPaper(target: Ctx2D): void {
    target.save();
    target.setTransform(1, 0, 0, 1, 0, 0);
    target.scale(this.dprValue, this.dprValue);
    target.globalCompositeOperation = "source-over";
    target.globalAlpha = 1;
    target.fillStyle = this.palette.paper;
    target.fillRect(0, 0, this.width, this.height);
    target.restore();
  }

  fallbackColor(weights: Ink): string {
    let rgb: [number, number, number] = hexToRgb(this.palette.paper);
    for (const channel of INK_ORDER) {
      const alpha = Math.min(1, weights[channel] * CELL_ALPHA);
      if (alpha <= 0) continue;
      const multiplied = multiplyChannel(rgb, this.palette[channel]);
      rgb = [
        multiplied[0] * alpha + rgb[0] * (1 - alpha),
        multiplied[1] * alpha + rgb[1] * (1 - alpha),
        multiplied[2] * alpha + rgb[2] * (1 - alpha),
      ];
    }
    return `rgb(${Math.round(rgb[0])}, ${Math.round(rgb[1])}, ${Math.round(rgb[2])})`;
  }

  composite(target: Ctx2D, jolt: number): void {
    this.paintPaper(target);
    if (this.degradedValue) return;

    const jScale = 1 + Math.max(0, Math.min(1, jolt)) * JOLT_SCALE;
    const elapsed = this.loadStart === null ? Number.POSITIVE_INFINITY : performance.now() - this.loadStart;

    target.save();
    target.setTransform(1, 0, 0, 1, 0, 0);
    target.scale(this.dprValue, this.dprValue);
    target.globalCompositeOperation = "multiply";
    target.globalAlpha = 1;

    INK_ORDER.forEach((channel, i) => {
      const base = REGISTRATION[channel];
      const [ux, uy] = unit(base);
      const staggerStart = i * REGISTER_LOAD_STAGGER_MS;
      const t = Math.max(0, Math.min(1, (elapsed - staggerStart) / REGISTER_LOAD_DURATION_MS));
      const eased = easeOutCubic(t);
      const extra = REGISTER_LOAD_DISTANCE_PX * (1 - eased);
      const ox = base[0] * jScale + ux * extra;
      const oy = base[1] * jScale + uy * extra;
      const layer = this.layers[channel];
      target.drawImage(layer.canvas as CanvasImageSource, ox, oy, this.width, this.height);
    });

    target.restore();

    if (!this.loadDone && this.loadStart !== null) {
      const totalDuration = (INK_ORDER.length - 1) * REGISTER_LOAD_STAGGER_MS + REGISTER_LOAD_DURATION_MS;
      if (elapsed >= totalDuration) {
        this.loadDone = true;
        this.loadOnDone?.();
      }
    }
  }

  resize(width: number, height: number, dpr: number): void {
    this.width = width;
    this.height = height;
    this.dprValue = dpr;
    this.layers = this.createLayers();
  }

  sample(frameMs: number): void {
    if (this.degradedValue || frameMs <= 0) return;
    const fps = 1000 / frameMs;
    if (fps < FPS_FALLBACK_THRESHOLD) {
      this.badMs += frameMs;
      if (this.badMs >= FPS_FALLBACK_MS) this.degradedValue = true;
    } else {
      this.badMs = 0;
    }
  }

  playLoadAnimation(onDone?: () => void): void {
    if (reducedMotion()) {
      onDone?.();
      return;
    }
    this.loadStart = performance.now();
    this.loadOnDone = onDone;
    this.loadDone = false;
  }
}

export function createLayers(width: number, height: number, dpr: number): InkLayers {
  return new LayersImpl(width, height, dpr);
}

/**
 * Decaying jolt accumulator. Collisions add energy; it falls off over
 * JOLT_DECAY_MS. Shared so the loop can feed it every collision event and
 * read one number.
 */
export function createJolt(): {
  add(energy: number): void;
  /** Advance and read, 0..1. */
  tick(dtMs: number): number;
} {
  let energy = 0;
  return {
    add(e: number): void {
      energy += Math.max(0, e);
    },
    tick(dtMs: number): number {
      energy = Math.max(0, energy - dtMs / JOLT_DECAY_MS);
      return Math.min(1, energy);
    },
  };
}

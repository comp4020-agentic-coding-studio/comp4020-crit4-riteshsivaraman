// SCRATCH — Issue 5 dev harness. See render-preview.html. Delete both
// before Issue 6 wires the real page; this is not part of the shipped site.
//
// Uses the real interaction module (attachPointer) and audio engine, not
// hand-rolled listeners, so tap / hold / release / drag-existing-organism /
// fling all behave exactly as they will once Issue 6 wires the real page.
import { createEngine } from "../src/lib/audio";
import { attachPointer, type ChargeState } from "../src/lib/interaction/pointer";
import { GRAIN_TILE, MAX_DPR, MAX_POPULATION } from "../src/lib/constants";
import { randomGenome } from "../src/lib/genetics";
import { createJolt, createLayers } from "../src/lib/render/layers";
import { drawCharge, drawPopulation, type Charge } from "../src/lib/render/cells";
import { createGrainTile, paintGrain } from "../src/lib/render/grain";
import { createWorld } from "../src/lib/sim";

const canvas = document.querySelector<HTMLCanvasElement>("#stage")!;
const ctx = canvas.getContext("2d")!;
const stats = document.querySelector<HTMLSpanElement>("#stats")!;

const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
let width = window.innerWidth;
let height = window.innerHeight;

const world = createWorld({ width, height });
const engine = createEngine();
const layers = createLayers(width, height, dpr);
const jolt = createJolt();
const grainPattern = createGrainTile(GRAIN_TILE);

function resize(): void {
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  world.resize(width, height);
  layers.resize(width, height, dpr);
}
window.addEventListener("resize", resize);
resize();

let charge: Charge | null = null;

attachPointer({
  canvas,
  world,
  engine,
  onFirstGesture: () => {},
  onChargeChange: (next: ChargeState | null) => {
    charge = next;
  },
});

document.querySelector("#spawn200")!.addEventListener("click", () => {
  for (let i = 0; i < MAX_POPULATION; i++) {
    world.spawn(randomGenome(Math.random), Math.random() * width, Math.random() * height, {
      vx: (Math.random() - 0.5) * 200,
      vy: (Math.random() - 0.5) * 200,
    });
  }
});

document.querySelector("#clear")!.addEventListener("click", () => world.clear());

layers.playLoadAnimation();

let last: number | null = null;
function frame(now: number): void {
  if (last === null) {
    last = now;
    requestAnimationFrame(frame);
    return;
  }
  const dtMs = now - last;
  last = now;
  layers.sample(dtMs);

  const result = world.step(dtMs / 1000, now);
  for (const collision of result.collisions) jolt.add(collision.energy);
  const j = jolt.tick(dtMs);

  if (layers.degraded) {
    layers.composite(ctx, j);
    drawPopulation(layers, world.organisms, now, ctx);
    if (charge) drawCharge(layers, charge, now, ctx);
  } else {
    layers.clear();
    drawPopulation(layers, world.organisms, now, ctx);
    if (charge) drawCharge(layers, charge, now, ctx);
    layers.composite(ctx, j);
    if (grainPattern) paintGrain(ctx, grainPattern);
  }

  stats.textContent = `${world.organisms.length} organisms · ${(1000 / dtMs).toFixed(0)}fps${layers.degraded ? " · DEGRADED" : ""}`;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Wiring only — every rule that matters lives in the modules this imports.
// See dev/render-preview.ts (deleted by this issue) for the harness this
// was proven against: same interaction module, same audio engine, same
// render pipeline, just against a real page instead of a scratch one.
import { createEngine } from "../lib/audio";
import { attachControls, attachKeyboard, attachPointer, type ChargeState } from "../lib/interaction";
import { GRAIN_TILE, MAX_DPR } from "../lib/constants";
import { createJolt, createLayers } from "../lib/render/layers";
import { drawCharge, drawPopulation, type Charge } from "../lib/render/cells";
import { createGrainTile, paintGrain } from "../lib/render/grain";
import { createWorld } from "../lib/sim";

const canvas = document.querySelector<HTMLCanvasElement>("#stage")!;
const ctx = canvas.getContext("2d")!;
const invite = document.querySelector<HTMLElement>("[data-invite]")!;
const specimen = document.querySelector<HTMLElement>("#specimen")!;
const aboutLink = document.querySelector<HTMLAnchorElement>("#about-link")!;
const aboutDialog = document.querySelector<HTMLDialogElement>("#about-dialog")!;
const aboutClose = document.querySelector<HTMLButtonElement>("#about-close")!;

const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
const viewport = window.visualViewport;
let width = viewport?.width ?? window.innerWidth;
let height = viewport?.height ?? window.innerHeight;

const world = createWorld({ width, height });
const engine = createEngine();
const layers = createLayers(width, height, dpr);
const jolt = createJolt();
const grainPattern = createGrainTile(GRAIN_TILE);

function resize(): void {
  width = viewport?.width ?? window.innerWidth;
  height = viewport?.height ?? window.innerHeight;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  world.resize(width, height);
  layers.resize(width, height, dpr);
}
window.addEventListener("resize", resize);
viewport?.addEventListener("resize", resize);
resize();

function dismissInvite(): void {
  invite.setAttribute("data-dismissed", "");
}

let charge: Charge | null = null;

attachPointer({
  canvas,
  world,
  engine,
  onFirstGesture: dismissInvite,
  onChargeChange: (next: ChargeState | null) => {
    charge = next;
  },
});

attachKeyboard({
  world,
  engine,
  canvas,
  onFirstGesture: dismissInvite,
});

attachControls({
  root: specimen,
  world,
  engine,
  onClear(): void {
    engine.releaseAll();
    world.clear();
  },
});

aboutLink.addEventListener("click", (event) => {
  event.preventDefault();
  aboutDialog.showModal();
});
aboutClose.addEventListener("click", () => aboutDialog.close());

layers.playLoadAnimation();

const panFromX = (xNorm: number): number => Math.max(-1, Math.min(1, xNorm * 2 - 1));

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
  for (const collision of result.collisions) {
    jolt.add(collision.energy);
    engine.play({
      degree: collision.voice.genome.degree,
      level: collision.energy,
      brightness: (collision.a.genome.brightness + collision.b.genome.brightness) / 2,
      decay: (collision.a.genome.decay + collision.b.genome.decay) / 2,
      pan: panFromX(collision.x / width),
    });
  }
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

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

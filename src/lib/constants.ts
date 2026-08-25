/**
 * Single source of truth for every tuned number in the instrument.
 *
 * Values marked ★ were tuned by ear on the sound bench before any code was
 * written. Changing one without listening is how a working instrument stops
 * sounding good while every test stays green — no sensor in this repo can
 * hear. If you need a number that is not here, that is a gap in `plan.md`;
 * add it here and say so, rather than inlining a literal at the call site.
 */

// ─── population ──────────────────────────────────────────────────────────
export const MAX_POPULATION = 220;
/** When over the cap, cull oldest down to this — hysteresis, so we don't
 *  cull one organism per frame forever at the boundary. */
export const CULL_TARGET = 200;
/** Seconds an organism lives, mapped from Genome.lifespan. */
export const LIFESPAN_RANGE: readonly [number, number] = [18, 45];

// ─── physics ─────────────────────────────────────────────────────────────
export const FIXED_DT = 1 / 120;
/** Never run more than this many substeps for one frame: a slow frame must
 *  not cause a longer frame, which causes more substeps, which... */
export const MAX_SUBSTEPS = 4;
export const RADIUS_RANGE: readonly [number, number] = [6, 26];
/** Velocity retained per substep — near-frictionless (~11% loss/s). */
export const DRAG = 0.999;
export const WALL_RESTITUTION = 0.86;
export const RESTITUTION_RANGE: readonly [number, number] = [0.55, 0.95];
/** Fraction of overlap corrected per resolution pass. 1.0 jitters. */
export const POSITIONAL_CORRECTION = 0.8;
/** Spatial grid cell size in px. Must be >= 2 * RADIUS_RANGE[1]. */
export const GRID_CELL = 56;
/** Below this speed (px/s) a cell is considered asleep and gets a tiny
 *  random push so the plate never fully stills — a petri dish keeps
 *  drifting. Not bench-tuned — added while polishing feel post-Issue-4;
 *  revisit at the sound/visual bench. Kept comfortably under
 *  MIN_COLLISION_SPEED so ambient drift alone doesn't spam collision sound. */
export const AMBIENT_SLEEP_SPEED = 6;
/** px/s magnitude of the ambient nudge applied to a sleeping cell. */
export const AMBIENT_IMPULSE = 10;

// ─── collision → sound ───────────────────────────────────────────────────
/** ★ Below this approach speed a collision resolves physically but is
 *  silent. This is the main dial against "it sounds like rain". */
export const MIN_COLLISION_SPEED = 40;
/** ★ Per-organism gate on collision *events*, not on physics. */
export const COLLISION_COOLDOWN_MS = 120;
/** Approach speed that maps to energy 1.0. */
export const MAX_EVENT_SPEED = 900;

// ─── audio ───────────────────────────────────────────────────────────────
/** ★ Hard ceiling on simultaneously sounding voices. Invariant I2. */
export const VOICE_CAP = 16;
export const MASTER_GAIN = 0.55; // ★
export const ATTACK_RANGE: readonly [number, number] = [0.004, 0.02]; // ★
export const RELEASE_RANGE: readonly [number, number] = [0.35, 2.4]; // ★
export const CUTOFF_RANGE: readonly [number, number] = [420, 4200]; // ★ Hz
/** ★ Level of the second (harmonic) oscillator at brightness = 1. */
export const PARTIAL_GAIN = 0.34;
/** Seconds to fade a stolen voice before stopping it. Below ~8ms clicks. */
export const STEAL_FADE = 0.012;

// ─── reproduction ────────────────────────────────────────────────────────
export const BREED_CHANCE = 0.06; // ★ per qualifying collision
export const BREED_COOLDOWN_MS = 2600;
export const BREED_MIN_ENERGY = 0.35;
/** Default position of the DRIFT control, 0..1. */
export const DRIFT_DEFAULT = 0.35;
/** Probability that a birth steps `degree` at all. Everything else about
 *  mutation is continuous; `degree` is not. See invariant I4. */
export const DEGREE_MUTATION_P = 0.3;

// ─── interaction ─────────────────────────────────────────────────────────
/** A press shorter than this is a tap, not a hold. */
export const HOLD_THRESHOLD_MS = 140;
/** Level and decay of the sustained voice while dragging a held cell. Not
 *  in plan.md — added while building Issue 4 because the held voice needs
 *  a full NoteSpec. Not yet tuned by ear; revisit at the sound bench. */
export const HOLD_NOTE_LEVEL = 0.8;
export const HOLD_NOTE_DECAY = 0.6;

// ─── render ──────────────────────────────────────────────────────────────
export const MAX_DPR = 2;
/** Base registration offsets per ink layer, in CSS px. The print is always
 *  slightly out of register; on a collision it jolts. See plan.md §2.5. */
export const REGISTRATION: Readonly<Record<InkChannel, readonly [number, number]>> = {
  pink: [1.2, -0.4],
  blue: [-0.9, 0.8],
  yellow: [0.3, 1.1],
};
export const JOLT_SCALE = 3.5;
export const JOLT_DECAY_MS = 140;
/** ★-adjacent: 0.62 is the design artifact's value, confirmed against its
 *  §2.5 panel — a soft rose, a medium sky blue, a soft lemon, with the triple
 *  overlap a warm dark olive-brown. Raised to 0.75 post-Issue-4 for more
 *  saturated single cells, but working the multiply forward from `--paper`
 *  showed that traded away the six overprint colours §2.2 promises: at 0.75
 *  the triple overlap crushes to near-black on screen, indistinguishable
 *  from flat density-as-darkness. The six colours are the point of the
 *  direction, so 0.62 wins. Before raising it again, re-check a dense clump
 *  still reads as a deep warm overprint and not flat black; see plan.md
 *  §9/§6. */
export const CELL_ALPHA = 0.62;
export const GRAIN_ALPHA = 0.05;
export const GRAIN_TILE = 128;
/** Rolling FPS below this for FPS_FALLBACK_MS drops to single-layer mode. */
export const FPS_FALLBACK_THRESHOLD = 45;
export const FPS_FALLBACK_MS = 2000;
/** Seconds before death a cell starts shrinking and fading. See §7 Issue 5. */
export const FADE_SECONDS = 1.2;
/** Page-load registration animation (§2.6): layers slide in from this far
 *  out, staggered, easing in. Matches tokens.css --register-duration/
 *  --register-stagger — kept in sync by hand, since one is CSS and the
 *  other drives a canvas animation. */
export const REGISTER_LOAD_DISTANCE_PX = 14;
export const REGISTER_LOAD_DURATION_MS = 520;
export const REGISTER_LOAD_STAGGER_MS = 90;
/** How much darker the nucleus is than the rest of the cell, as extra
 *  alpha on top of CELL_ALPHA. Not bench-tuned — added while building
 *  Issue 5; nudged up slightly alongside CELL_ALPHA for more contrast;
 *  revisit at the visual bench. */
export const NUCLEUS_DARKEN = 0.3;
/** Pulse amplitude as a fraction of radius, and rate range (Hz) mapped
 *  from genome.speed 0..1. Not bench-tuned — added while building Issue 5. */
export const PULSE_AMPLITUDE = 0.06;
export const PULSE_RATE_RANGE: readonly [number, number] = [0.6, 2.2];

export type InkChannel = "pink" | "blue" | "yellow";

// ─── live parameters ─────────────────────────────────────────────────────
/**
 * Five 0..1 "culture condition" knobs (Issue 13) — petri-dish language for
 * things a player can hear or see move within a second: fertility, vigour,
 * viscosity, bounce, chatter. `world.ts` maps each 0..1 knob onto the
 * ranges below at the point of use; nothing here is bench-tuned by ear the
 * way the ★ values are — every range is a guess bracketing the existing
 * tuned constant, in the same spirit as AMBIENT_IMPULSE and NUCLEUS_DARKEN
 * above. Revisit at the sound/feel bench once sliders exist to bench with.
 */
export const FERTILITY_CHANCE_RANGE: readonly [number, number] = [0.01, 0.45];
/** Inverse: higher fertility, shorter cooldown between one organism's births. */
export const FERTILITY_COOLDOWN_RANGE: readonly [number, number] = [4200, 600];
export const VIGOUR_IMPULSE_RANGE: readonly [number, number] = [2, 34];
/** Scales a newborn's inherited velocity — a vigorous culture flings its young. */
export const VIGOUR_BIRTH_RANGE: readonly [number, number] = [0.3, 1.6];
/** Inverse: higher viscosity, less velocity retained per substep. */
export const VISCOSITY_DRAG_RANGE: readonly [number, number] = [1.0, 0.982];
export const BOUNCE_WALL_RANGE: readonly [number, number] = [0.45, 1.0];
/** Multiplies `restitutionOf` at organism creation. >1 at bounce = 1 is
 *  deliberate energy injection (see plan.md / Issue 13) — bounded by DRAG
 *  and MAX_POPULATION. If it runs away, clamp this range's top rather than
 *  adding an unnamed guard elsewhere. */
export const BOUNCE_RESTITUTION_SCALE_RANGE: readonly [number, number] = [0.6, 1.25];
/** Inverse: higher chatter, lower the speed floor for a collision to sound. */
export const CHATTER_SPEED_RANGE: readonly [number, number] = [110, 12];
/** Inverse: higher chatter, shorter the per-organism collision-sound cooldown.
 *  The top end is 40 rather than a rounder 45 so that the single chatter knob
 *  has ONE exact preimage for both of its targets: at 5/7 this lerp is exactly
 *  120ms while CHATTER_SPEED_RANGE is exactly 40px/s. Picked to keep the
 *  no-silent-retune guarantee exact on both halves; the endpoint itself is a
 *  guess bracketing a bench-tuned default, so revisit at the sound bench. */
export const CHATTER_COOLDOWN_RANGE: readonly [number, number] = [320, 40];

/**
 * Knob positions that reproduce the shipped constants exactly — the
 * no-silent-retune guarantee (see spec/sim.test.ts). Each is the exact
 * preimage of its `*_RANGE` lerp at the constant's current value, not the
 * rounded figure `plan.md`/Issue 13 show for readability (e.g. fertility
 * is `5/44`, which reads as "0.114" in prose but must be kept as the exact
 * fraction here or BREED_CHANCE stops reproducing to within 1e-9).
 *
 * `chatter` drives two constants from one knob, so its two ranges have to
 * agree on a preimage. The endpoints Issue 13 first specified did not —
 * (40, 120) solved at 5/7 for speed and 8/11 for cooldown — so
 * CHATTER_COOLDOWN_RANGE's top end was moved to 40 to make 5/7 exact for
 * both. If you retune either chatter range, re-derive the other's endpoint
 * from the same knob position rather than accepting a near miss.
 */
export const PARAM_DEFAULTS = {
  fertility: 5 / 44,
  vigour: 0.25,
  viscosity: 1 / 18,
  bounce: 41 / 55,
  chatter: 5 / 7,
};

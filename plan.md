# Culture — build plan

The guide for build sessions. Read this with `@plan.md` plus **one**
GitHub issue, then build that one module and `/clear`.

Concept and scope live in `notes/idea.md`. This file is the *how*: settled
numbers, module boundaries, contracts, and the design system. Where the two
disagree, this file wins — it's the later thought.

---

## 0. How to use this file

- You are building **one module**. Read §5 for the shared vocabulary, then
  only your module's section in §7. You do not need the others.
- Every constant you need is in §6. **Do not invent a number.** If a value
  you need isn't there, that's a gap in the plan — say so rather than
  guessing, because these numbers were tuned by ear on a bench and a guess
  will sound wrong in a way tests won't catch.
- The invariants in §4 have tests already written in `spec/`. They are red
  right now. Your module is done when its tests are green and `pnpm check`
  is green.
- Non-goals are in `idea.md` §8. Building something adjacent that nobody
  asked for is the main failure mode here.

---

## 1. What we're building, in one paragraph

A full-bleed canvas that behaves like a printed petri dish. Tapping it plays
a note immediately — pitch from height, pan and timbre from horizontal
position — and leaves behind a living cell that keeps playing as it bounces.
Holding swells a growing cluster with an audible rising tone; releasing
scatters it as a chord. Cells collide, sound, occasionally reproduce with
small mutations, and eventually fade out. The player plays *over* the
ecosystem they've seeded. Everything renders as three offset layers of
risograph ink on paper stock, so a cell's colour is literally a mixture and
a child's ink sits between its parents'.

---

## 2. The design system

### 2.1 Direction

**Risograph overprint.** Three spot inks printed on warm paper in three
passes that don't quite line up. Chosen over the obvious dark-canvas-with-
glow because glow is the default every generative audio toy arrives at, and
because overprint does conceptual work no other direction does: **where two
inks overlap they genuinely mix, so colour mixing IS genetic mixing.** The
metaphor isn't applied to the visuals, it's the same mechanism.

### 2.2 Colour

Real Risograph spot inks, not approximations.

| Token | Hex | Role |
|-------|-----|------|
| `--paper` | `#EFEAE0` | ground; warm uncoated stock |
| `--ink-pink` | `#FF48B0` | Fluorescent Pink — **pitch height** |
| `--ink-blue` | `#0078BF` | Medium Blue — **size / mass** |
| `--ink-yellow` | `#FFE800` | Yellow — **brightness / timbre** |
| `--ink-text` | `#2B2A28` | warm near-black; type only |
| `--paper-shadow` | `#DCD5C7` | the label's drop, rules, disabled states |

Three inks multiply into six perceivable colours (pink×blue = deep violet,
pink×yellow = vermilion, blue×yellow = green, all three = near-black). That
gives a rich palette from a constraint, which is the whole point of the
medium.

**Every cell colour is derived, never stored.** See §5.3.

### 2.3 Type

| Role | Face | Use |
|------|------|-----|
| Display | **Anton** | the wordmark and the invite line. Twice on the page, nowhere else. |
| Utility | **Space Mono** | every label, value, and control. Specimen-tag voice. |

The page is ~95% canvas, so the type budget is about eight words. That's an
argument for making those eight words characterful, not for having no type
opinion. Load both from Google Fonts with `preconnect` and `display=swap`;
set a mono system fallback so a cold cache doesn't reflow the label.

Scale: wordmark 28px/0.9/-0.02em, invite 15px, labels 11px/0.14em uppercase,
values 13px. Nothing else.

### 2.4 Layout

The canvas is the page. Chrome is two printed objects stuck onto it.

```
┌─────────────────────────────────────────────────┐
│ CULTURE                              About      │  ← h1 + nav, hairline
│ a plate that plays                              │
│                                                 │
│                                                 │
│                  tap anywhere                   │  ← invite, fades on
│                 higher is higher                │    first gesture
│                                                 │
│                                                 │
│                                                 │
│ ┌──────────────────────────────┐                │
│ │ MOOD    ▸ bright             │                │  ← specimen label,
│ │ DRIFT   ▸▏▔▔▔▔▔▔▔▔           │                │    bottom-left, not a
│ │ LEVEL   ▸▔▔▔▔▔▔▏▔▔           │                │    full-width bar
│ │ ────────────────  clear      │                │
│ └──────────────────────────────┘                │
└─────────────────────────────────────────────────┘
```

A bottom-left label reads as a thing stuck to a plate; a full-width bottom
bar reads as app chrome. The label sits on `--paper` with a 2px offset
`--paper-shadow` and no border-radius — printed, not rendered.

### 2.5 The signature: the press slips

The three ink layers are composited with a small fixed registration offset,
so the print is always very slightly out of register. **On a collision, the
offset jolts** — the layers separate further for a few frames, proportional
to collision energy, then settle back.

So a loud note *looks* like the press slipping. Sound and sight are coupled
through the language of the medium rather than through a generic particle
flash. This is the one place boldness is spent; everything else stays quiet.

Base offsets, in CSS pixels: pink `(+1.2, -0.4)`, blue `(-0.9, +0.8)`,
yellow `(+0.3, +1.1)`.

### 2.6 Motion

- **Page load:** the three ink layers slide into register from ~14px out,
  staggered 90ms, 520ms ease-out. One orchestrated moment; the page prints
  itself. Nothing else animates on load.
- **Ambient:** cells pulse subtly at a rate tied to `speed`. That's the
  simulation, not decoration.
- **Reduced motion:** `prefers-reduced-motion` skips the load registration
  and freezes the grain. The simulation still runs — it *is* the
  instrument, and disabling it would disable the product.

### 2.7 Grain

One 128×128 noise tile generated once at startup, tiled over the whole
canvas at `globalAlpha` 0.05, composite `multiply`. Static. Regenerating it
per frame is a shimmer that looks like video noise, not paper.

### 2.8 Copy

Sentence case, plain, from the player's side of the screen.

| Element | Copy | Why |
|---------|------|-----|
| Wordmark | `CULTURE` | h1 |
| Tagline | `a plate that plays` | |
| Invite | `tap anywhere` / `higher is higher` | teaches the single mapping in three words, and it is the gesture that unlocks the AudioContext |
| Mood | `bright` / `deep` / `open` | moods, not `C major pentatonic`. Nobody needs theory to pick a feeling. |
| Drift | `DRIFT` | mutation strength. One knob for the whole evolution system. |
| Level | `LEVEL` | master gain |
| Clear | `clear` | fades everything out. Not "reset" — there is no state to fail back from. |

---

## 3. Architecture

```
        pointer / keyboard
                │
                ▼
        ┌───────────────┐
        │  interaction  │  gesture grammar: tap · hold · release
        └───────┬───────┘
                │ spawn(genome, x, y)   noteOn/noteOff
        ┌───────┴───────────────────┬─────────────┐
        ▼                           │             ▼
  ┌───────────┐   breed()    ┌──────┴─────┐  ┌─────────┐
  │    sim    │◄────────────►│  genetics  │  │  audio  │
  │ step(dt)  │              │ pure fns   │  │ Web API │
  └─────┬─────┘              └──────┬─────┘  └─────────┘
        │ CollisionEvent[]          │ inkOf(genome)   ▲
        │                           │                 │
        └───────────────────────────┴─────────────────┘
                │
                ▼
        ┌───────────────┐
        │    render     │  3 ink layers → multiply → paper
        └───────────────┘
```

**Dependency rule:** `genetics` depends on nothing. `sim` depends on
`genetics`. `audio` depends on nothing but its own config. `interaction` and
`render` depend on the three above. Nothing depends on `interaction` or
`render`. If you find yourself importing `audio` into `sim`, stop — `sim`
emits events, it does not make sound.

That rule is what keeps `sim` and `genetics` unit-testable without a DOM or
an AudioContext, which is what makes the invariant tests in §4 possible at
all.

### 3.1 Files

```
src/
  lib/
    genetics/
      genome.ts       Genome type, random, clamp, bounds
      breed.ts        inherit + mutate
      ink.ts          genome → ink weights (derived colour)
      index.ts
    sim/
      types.ts        Organism, CollisionEvent, World
      world.ts        create, spawn, step, cull, population cap
      physics.ts      integrate, walls, circle-circle resolve  [REFERENCE IMPL]
      grid.ts         uniform spatial hash
      index.ts
    audio/
      engine.ts       AudioContext lifecycle, master chain    [REFERENCE IMPL]
      voices.ts       voice pool, cap, stealing               [REFERENCE IMPL]
      scales.ts       moods, degree → frequency
      index.ts
    interaction/
      pointer.ts      tap / hold / drag / release
      keyboard.ts     home-row voice
      controls.ts     the specimen label
      index.ts
    render/
      layers.ts       3 offscreen ink layers + composite
      cells.ts        draw one organism into the layers
      grain.ts        the noise tile
      index.ts
    constants.ts      §6, single source of truth
  pages/index.astro
  layouts/Layout.astro
  scripts/main.ts     wiring only: create world, engine, loop. No logic.
  styles/
    tokens.css        §2.2 as custom properties
    global.css
```

`main.ts` is **wiring only**. If it grows logic, that logic belongs in a
module.

---

## 4. The invariants

These have tests in `spec/`. They are the sensors; they are red now.

| # | Invariant | Where |
|---|-----------|-------|
| I1 | Population never exceeds `MAX_POPULATION`, under any sequence of spawns and births | `sim` |
| I2 | Simultaneously sounding voices never exceed `VOICE_CAP` | `audio` |
| I3 | Every emitted frequency is a member of the active mood's scale | `audio` |
| I4 | `degree` mutates by **whole steps only**; all genome fields stay within `GENOME_BOUNDS` after any number of generations | `genetics` |
| I5 | An organism cannot emit two collision notes within `COLLISION_COOLDOWN_MS` | `sim` |
| I6 | The AudioContext is created suspended and only resumes on a user gesture | `audio` |
| I7 | Identical genomes derive identical ink; ink is never stored on the organism | `genetics` |
| I8 | The built page keeps one `<h1>`, a `<nav>`, description, og:image, viewport | shell (shipped invariants) |

**I3 is the load-bearing one.** Spec line 6 says "there is no way to play it
wrong." We satisfy that *by construction*: pitch is a **scale-degree index**
from the gesture all the way to the oscillator, converted to Hz only at the
last step inside `audio/scales.ts`. No other module may compute a frequency.
Mutation moves the index by whole steps, so a mutant is still in key. There
is no code path that can produce an out-of-scale note, which is a stronger
guarantee than a rule someone has to remember.

---

## 5. Shared vocabulary

### 5.1 The genome

```ts
type Genome = {
  degree: number      // int, index into the active scale across 3 octaves
  size: number        // 0..1 → radius, mass, loudness
  bounce: number      // 0..1 → restitution
  speed: number       // 0..1 → initial energy, pulse rate
  brightness: number  // 0..1 → filter cutoff, harmonic mix, yellow ink
  decay: number       // 0..1 → note release length
  lifespan: number    // 0..1 → seconds alive
}
```

Seven fields. `hue` from `idea.md` is gone — colour is derived (§5.3), and
`octave` folded into `degree` because a single index across three octaves is
what makes I3 and I4 trivially true.

### 5.2 Pitch is an index, never a frequency

```
tap y  ──►  degree (int)  ──►  Genome.degree  ──►  scales.freq(degree, mood)  ──►  Hz
                                                    └── the ONLY place Hz exists
```

### 5.3 Ink is derived

```ts
inkOf(g: Genome): { pink: number; blue: number; yellow: number }  // each 0..1
  pink   = g.degree / (SCALE_SPAN - 1)   // high notes are pink
  blue   = g.size                        // big, heavy cells are blue
  yellow = g.brightness                  // bright timbre is yellow
```

Pure, memoisable, no randomness. A child that mutated its pitch looks
different by exactly as much as it sounds different — which is the entire
"you can see evolution happening" feature, for the cost of one function.

### 5.4 Events

`sim.step(dt)` returns events; it never calls into audio.

```ts
type CollisionEvent = {
  a: Organism; b: Organism
  speed: number       // relative approach speed, px/s
  x: number; y: number
  energy: number      // 0..1 normalised, drives level and the registration jolt
}
type BirthEvent = { child: Organism; parent: Organism }
type DeathEvent = { organism: Organism }
type StepResult = { collisions: CollisionEvent[]; births: BirthEvent[]; deaths: DeathEvent[] }
```

---

## 6. Settled constants

`src/lib/constants.ts` is the single source of truth. Values marked ★ were
tuned by ear on the sound bench — do not change them without listening.

```ts
// population
MAX_POPULATION        = 220
CULL_TARGET           = 200   // when over cap, cull oldest down to this
LIFESPAN_RANGE        = [18, 45]      // seconds
// physics
FIXED_DT              = 1 / 120       // s, accumulator substep
MAX_SUBSTEPS          = 4             // never spiral on a slow frame
RADIUS_RANGE          = [6, 26]       // px, from size
DRAG                  = 0.995         // per substep velocity retention
WALL_RESTITUTION      = 0.86
RESTITUTION_RANGE     = [0.55, 0.95]  // from bounce
POSITIONAL_CORRECTION = 0.8           // overlap resolution factor
GRID_CELL             = 56            // px, ≥ 2 × max radius
// collision → sound
MIN_COLLISION_SPEED   = 40            // px/s ★ below this is silent
COLLISION_COOLDOWN_MS = 120           // ★ per organism
MAX_EVENT_SPEED       = 900           // px/s, normalises energy to 0..1
// audio
VOICE_CAP             = 16            // ★
MASTER_GAIN           = 0.55          // ★
ATTACK_RANGE          = [0.004, 0.02] // s ★
RELEASE_RANGE         = [0.35, 2.4]   // s ★ from decay
CUTOFF_RANGE          = [420, 4200]   // Hz ★ from brightness
PARTIAL_GAIN          = 0.34          // ★ second oscillator level at brightness=1
STEAL_FADE            = 0.012         // s, fade before stealing a voice
// reproduction
BREED_CHANCE          = 0.06          // ★ per qualifying collision
BREED_COOLDOWN_MS     = 2600          // per organism
BREED_MIN_ENERGY      = 0.35          // normalised collision energy floor
DRIFT_DEFAULT         = 0.35          // the DRIFT control, 0..1
DEGREE_MUTATION_P     = 0.30          // chance degree steps at all
// interaction
HOLD_THRESHOLD_MS     = 140           // below this a press is a tap
HOLD_SPAWN_INTERVAL   = 190           // ms per accumulated offspring
HOLD_MAX_CLUSTER      = 12
RELEASE_ARPEGGIO_MS   = 38            // stagger between dispersed notes
```

### 6.1 Moods

```ts
MOODS = {
  bright: { root: 60, steps: [0, 2, 4, 7, 9] },   // C major pentatonic
  deep:   { root: 45, steps: [0, 3, 5, 7, 10] },  // A minor pentatonic, low
  open:   { root: 50, steps: [0, 2, 5, 7, 9] },   // D suspended
}
SCALE_SPAN = 15   // 5 steps × 3 octaves; degree ∈ [0, 14]
```

`freq(degree, mood)`: octave = `floor(degree / steps.length)`, step =
`degree % steps.length`, midi = `root + 12 * octave + steps[step]`,
Hz = `440 * 2 ** ((midi - 69) / 12)`.

---

## 7. Module contracts

Each of these is one GitHub issue and one build session.

### Issue 1 — `genetics/` · no dependencies

Pure functions, no DOM, no audio. Build this first; everything imports it.

- `randomGenome(rng)` — uniform within `GENOME_BOUNDS`
- `breed(parent, drift, rng)` — copy, then mutate each 0..1 field by a
  Gaussian nudge scaled by `drift`, clamped. `degree` steps ±1 (rarely ±2)
  with probability `DEGREE_MUTATION_P`, clamped to `[0, SCALE_SPAN - 1]`.
  **Never** mutate `degree` continuously.
- `inkOf(genome)` — §5.3, pure
- `clampGenome(g)` — the bounds enforcer, exported so tests can fuzz it

**Done when:** 10 000 generations of repeated `breed` never leave bounds and
never produce a non-integer `degree`; `inkOf` is referentially transparent.

### Issue 2 — `audio/` · no dependencies

The synth. `physics.ts` and this module have the reference implementations;
read them before changing them.

- `createEngine()` returns an engine whose context is **suspended**
- `engine.resume()` — called once, from the first user gesture
- `engine.play(note)` where `note = { degree, level, brightness, decay, pan }`
- `engine.hold(note)` → returns a handle with `.update(note)` and `.release()`
  for the swell gesture
- master chain: `voices → compressor → masterGain → destination`
- voice cap with oldest-stolen, `STEAL_FADE` ramp down before stop, so
  stealing is inaudible
- all gain changes use `setTargetAtTime` / ramps — **never** `.value =`
  on a live node, that's a click

**Done when:** I2, I3, I6 green; holding 40 rapid notes never exceeds
`VOICE_CAP` live voices and produces no clicks by ear.

### Issue 3 — `sim/` · depends on genetics

- `createWorld(w, h)`, `world.spawn(genome, x, y, vx, vy)`,
  `world.step(dt): StepResult`, `world.clear()`
- fixed-timestep accumulator, `MAX_SUBSTEPS` cap
- uniform spatial grid; **no pair tested twice per step**
- walls bounce with `WALL_RESTITUTION`
- collisions below `MIN_COLLISION_SPEED` resolve physically but emit no event
- per-organism collision cooldown gates *events*, not physics
- lifespan countdown → `DeathEvent`; over cap → cull oldest to `CULL_TARGET`
- breeding: on a qualifying collision, roll `BREED_CHANCE`, respect
  `BREED_COOLDOWN_MS` and the cap, call `genetics.breed`

**Done when:** I1, I5 green; a 60-second headless run with aggressive
spawning stays under the cap and never emits two events for one organism
inside the cooldown.

### Issue 4 — `interaction/` · depends on sim, audio, genetics

The gesture grammar. This is the module the crit actually judges.

- Pointer Events only (mouse and touch are one code path); `touch-action:
  none` on the canvas
- **tap** (< `HOLD_THRESHOLD_MS`): `engine.play` **in the same frame as
  pointerdown** — do not wait for the sim — then spawn
- **hold**: start a held voice on pointerdown; grow the nucleus; accumulate
  an offspring every `HOLD_SPAWN_INTERVAL` up to `HOLD_MAX_CLUSTER`; update
  the held voice's degree as the pointer moves (glide)
- **release**: disperse the cluster outward in a burst — evenly spaced
  around the full circle, not a cone along the drag vector, since the
  packed cluster is a ball and release reads as that ball bursting apart
  — play their notes staggered by `RELEASE_ARPEGGIO_MS`, release the held
  voice
- **grab** (added post-Issue-4, while building Issue 5): pointerdown that
  hits an existing organism drags it instead of seeding a new one — no tap
  sound, no spawn. The organism is marked `held` so physics treats it as
  pointer-driven and infinite-mass (still bumps and sounds against the rest
  of the population while dragged); release keeps the last pointer-velocity
  estimate as a fling. Reachable only through the real `attachPointer`, not
  through hand-rolled pointer listeners — see `dev/render-preview.ts`.
- **keyboard**: `A S D F G H J K` → 8 degrees; same three verbs; keydown
  plays and spawns, keyup releases. Ignore auto-repeat.
- first gesture of any kind: `engine.resume()` and dismiss the invite
- pointercancel / blur / visibilitychange must release held voices — a
  stuck drone is the worst possible bug in a crit

**Done when:** a tap produces a note with no perceptible delay; there is no
gesture that leaves a voice sounding forever.

### Issue 5 — `render/` · depends on sim, genetics

Judged by eye. Minimal tests.

- three offscreen ink layers, sized to `min(devicePixelRatio, 2)`
- each organism draws its `inkOf` weights into the three layers
- composite layers onto paper with `multiply` and the §2.5 offsets
- collision jolt: scale offsets by `1 + energy * 3.5`, decaying over ~140ms
- cells: filled disc, slightly darker nucleus at 45% radius, subtle pulse
- death: shrink and fade over the last 1.2s of life
- charge nucleus: growing disc with orbiting accumulated offspring
- grain tile (§2.7), page-load registration animation (§2.6)
- **adaptive fallback:** if the rolling FPS drops below 45 for 2s, switch to
  single-layer direct drawing and drop the grain. Ship the fallback; a
  beautiful 20fps instrument is a broken instrument.

**Done when:** 200 organisms hold 60fps on the laptop and ≥45fps on a phone,
or the fallback engages.

### Issue 6 — shell · depends on everything

- `index.astro`: `<h1>CULTURE</h1>`, a real `<nav>`, the canvas, the
  specimen label, the invite, the about dialog
- **The invariant trap:** the shipped invariants require exactly one `<h1>`
  and a `<nav>` on a page that is otherwise a full-bleed canvas. The `<nav>`
  holds one link that opens the about `<dialog>`. Don't delete it to tidy
  the markup; `pnpm check` will go red.
- `tokens.css` from §2.2, fonts, reduced-motion
- page must not scroll on any viewport; canvas resizes to `visualViewport`
- replace the og card and the meta description
- delete `spec/starter.test.ts` and `[data-testid="intro"]`
- `main.ts` wiring only

**Done when:** `pnpm check` and `pnpm check:evidence` green, and the page
looks right at both marking viewports.

---

## 8. Two-day order

**Day 1 — playable by end of day.** Issues 1 → 2 → 3 → 4.
That sequence ends with: tap makes a note, hold swells, release throws a
chord, cells keep playing. Rendering can be flat grey discs at this point
and it is still a submittable C4. Front-loading the spec-critical work is
deliberate: a day-2 disaster then costs polish, not the deliverable.

**Day 2 — make it a printed object, then ship.** Issues 5 → 6, then
`PROCESS.md`, `reflections/crit-4.md`, `/ship`.

`/clear` between every issue. Review passes get their own fresh session
pointed at the diff.

---

## 9. Known risks

| Risk | Signal | Mitigation |
|------|--------|------------|
| Multiply blending muds up at high density | dense clumps go black | per-cell alpha raised to 0.75 (from 0.62) post-Issue-4 to fix a washed-out palette; re-verified with `spawn200` that dense clumps still read as a deep overprint, not flat black — density-as-darkness is acceptable and arguably correct, but this is now closer to the edge, so re-check with `spawn200` before raising it again |
| Three fullscreen layers too slow on mobile | FPS < 45 | the adaptive single-layer fallback in Issue 5, shipped not deferred |
| Collision notes turn to mush | it sounds like rain | `MIN_COLLISION_SPEED` and the cooldown are the dials; raise them before touching anything else |
| Held voice survives a pointercancel | a drone that won't stop | explicitly listed in Issue 4's done-when |
| Light paper ground makes yellow ink invisible | yellow cells vanish | yellow never carries pitch — it's `brightness`, a secondary axis, and always co-printed with pink or blue |
| Population reads as static once seeded | nothing drifts, looks frozen | `DRAG` raised to 0.999 (from 0.995) plus an ambient sleep-nudge in `sim/world.ts`, post-Issue-4; confirmed cells kept drifting between two screenshots 5s apart instead of settling to a stop |
| A single growing nucleus disc didn't read as multiplying cells | breeding looked like one blob inflating, not division | `render/cells.ts` replaced the growing-nucleus + tiny-satellite-dot design with equal-sized buds (`BUD_RADIUS`, fixed) that divide off a random existing bud and pack together via overlap resolution, per direct feedback with a cancer-cell-doubling reference image; confirmed by rendering `drawCharge` at increasing `count` and checking for a non-overlapping, organically packed clump with no dominant central disc |
| `dev/render-preview.ts`'s FPS fallback can trip into permanent DEGRADED mode from a single slow frame (e.g. right after page load) | preview stuck flat-colour with no grain | one-way flip by design (see Issue 5); reload the harness if it trips early — not a shipped-page concern until Issue 6 tunes the real threshold |

---

## 10. What a marker should be able to trace

Each issue closes with commits that reference it. `learnings.md` accumulates
as we go and becomes `PROCESS.md`. The moments most worth citing are the
ones where a correction landed in the harness rather than in a retry:

- the spec-vs-`idea.md` conflict and the inversion that resolved it
  (already logged, 2026-08-24)
- pitch-as-scale-degree making spec line 6 true by construction, with I3 as
  the sensor that keeps it true
- whichever invariant first goes red during the build — that's the one worth
  writing about, because it's the one the plan got wrong

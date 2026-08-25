# Culture — an instrument you play by seeding life

Crit 4 idea doc, v1. Scoped to two days.
Supersedes `idea-v0-original.md` (the 30-section version); that file stays as
the source of ideas to mine from if there's time left, which there won't be.

---

## 0. The one-line pitch

> A canvas of living cells. You touch it and it sings; the cells you leave
> behind keep singing, and their children sound a little different from
> their parents.

Working title **Culture** — a bacterial culture, and a musical one. Rename
freely, but the doc uses it as a handle.

---

## 1. What changed from v0, and why

v0's stated principle was *"the user does not compose music, they evolve
it."* That is a beautiful principle and it is the wrong one for this crit.

The C4 spec is explicit:

- "the browser is the instrument — sound is made live in the page by the
  player, not played back"
- "it is expressive: the player's choices shape what they hear"
- "a stranger can play it uninstructed — the opening screen invites the
  first sound"

and the crit **opens cold**: the pod plays it before I speak. A design
where the player seeds conditions and then *watches* fails that room. They
poke it, hear sound they don't feel authorship of, and it reads as an
aquarium.

**The inversion that fixes it:** every gesture makes sound *at the moment
of the gesture*, with zero simulation latency. The ecosystem is not the
instrument — it is the **accompaniment the instrument leaves behind**. You
play over your own residue. Evolution becomes texture that drifts under
you, not a prerequisite for hearing anything.

```
gesture ──> sound  (immediate, every time, no exceptions)
   │
   └──> organism ──> collisions ──> more sound
                          │
                          └──> offspring, pitch and hue drifted
```

Everything below follows from that inversion.

---

## 2. The interaction, in full

The whole instrument is one full-bleed canvas plus a thin control strip.

### Tap / click — the note

A tap plays a note **instantly** and spawns the organism that will keep
playing it.

- **Pitch comes from height.** Top of canvas = high, bottom = low,
  quantized to the current scale. The empty canvas is therefore already
  playable, like a one-axis theremin — a stranger's first tap is
  guaranteed to be musical.
- **Timbre/pan come from horizontal position.** Left–right pans the voice
  and shifts brightness slightly, so the canvas has two axes of feel.

This single behaviour is what satisfies "the opening screen invites the
first sound." Nothing must be understood first.

### Press and hold — the swell

Holding grows a nucleus, and the hold is **audible the entire time**:

- a sustained tone starts on press
- as the nucleus grows it gains harmonics and rises slightly in level
- offspring accumulate visibly around the nucleus as it grows
- **dragging while held glides the pitch** — the hold is a portamento
  gesture, not just a charge meter

A silent charge-up would be dead air in a cold-open crit. The hold must
sound like *something is being gathered*.

### Release — the chord

Release disperses the accumulated cluster outward from the release point.
Their pitches sound together as a **chord or fast arpeggio** — the payoff
of the swell. Dispersal direction/energy follows the drag, so a flicked
release throws a bright scattered chord and a still release drops a tight
cluster.

The gesture arc is: **touch → swell → burst → ecosystem.**

### Keyboard — the second voice

Home row (`A S D F G H J K`) plays scale degrees; each keypress sounds
immediately and spawns an organism in a corresponding lane. Hold a key to
swell, release to burst — the same three-verb grammar as the pointer.

This is deliberately a *second expressive surface*, not an accessibility
box-tick: someone can hold a chord on the keyboard while dropping cells
with the other hand. It is also the answer to spec line 5.

### Touch

Pointer Events throughout, so touch is the same code path as mouse.
Multi-touch is a nice-to-have, not a commitment.

### The living layer

Organisms bounce off walls and each other. Every collision above a
velocity threshold plays a note derived from the colliding genomes. They
fade and die after a lifespan, so the canvas returns to quiet if left
alone — the instrument never runs away from the player, and never needs a
"reset" to be usable again.

---

## 3. The genome

Small and legible. Nine fields, no more.

```ts
type Genome = {
  degree: number      // scale degree index → pitch (quantized, never raw Hz)
  octave: number      // -1 | 0 | 1
  size: number        // radius; also mass, also loudness
  bounce: number      // restitution → how rhythmically it keeps going
  speed: number       // initial energy → collision frequency
  brightness: number  // waveform blend / filter cutoff → timbre
  decay: number       // note envelope length
  lifespan: number    // seconds before it fades out
  hue: number         // derived from the above, not independent
}
```

**Rule: physical and musical properties come from the same fields.** Size
is mass *and* loudness. Speed is velocity *and* rhythmic density. Bounce
is restitution *and* repetition. The player learns the mapping by watching
and listening, never by reading a legend.

**Hue is derived, not stored independently** — it is a function of
`degree`, `brightness` and `octave`. That is what makes family resemblance
automatic: a child that mutated its pitch *looks* different by exactly as
much as it *sounds* different. This is the single cheapest way to make
evolution visible, and it costs one function.

---

## 4. Evolution — the minimum that reads

Kept: **inheritance, mutation, visible family resemblance.**
Cut: crossover, species, energy, zones, lineage stats, modes.

- **Division (player-driven).** Offspring from a hold inherit the
  nucleus's genome with small mutations. This is the main source of new
  genomes, and it is under the player's finger — which keeps authorship
  with them.
- **Collision reproduction (ambient).** A collision has a low probability
  of producing one child, gated by a per-organism cooldown and the
  population cap. Rare enough that the population doesn't explode; common
  enough that leaving the canvas alone for a minute audibly drifts.
- **Mutation.** Gaussian nudge on a couple of fields per birth, clamped to
  sane bounds. `degree` mutates in whole scale steps, never continuously —
  a mutant is still in key.

**Design guarantee:** because `degree` is an index into the scale and never
a raw frequency, no amount of mutation can produce a wrong note. Spec line
6 — "there is no way to play it wrong" — is satisfied *by construction*,
not by a rule someone has to remember. That is the sort of thing worth
writing down in `CLAUDE.md` and pinning with a test.

---

## 5. Sound

Warm, plucked, bell-like. Sine/triangle core, soft attack, long decay,
gentle lowpass whose cutoff tracks `brightness`.

- **Global key + scale**, default pentatonic (major pentatonic, C). A
  couple of alternates in the control strip (minor pentatonic, lydian-ish)
  so the player can change the mood without learning theory.
- **All pitch quantized** to the current scale, always.
- **No tempo grid in v1.** Rhythm comes from physics. A quantizing
  scheduler is a day of work and can make a lively canvas sound stiff —
  it's the first thing to add if there's spare time, not before.
- **Collision velocity → attack + level.** Mass difference → octave
  weighting. Big slow cells give low soft tones; small fast cells give
  bright ticks.

### Audio safety (non-negotiable, these are the invariants)

- hard **voice cap** (~16 simultaneous), oldest-stolen
- per-organism **collision cooldown** (~120 ms)
- **minimum collision velocity** threshold, so resting piles are silent
- master **compressor + limiter**, and a conservative master gain
- all gain changes ramped, never set instantaneously (no clicks)
- `AudioContext` created suspended, resumed on the first gesture — nothing
  sounds before the player's first tap, per the autoplay policy

These are exactly the things a type checker and my eyes won't catch, so
they get spec tests, not prose.

---

## 6. Visual design

Cells, not game balls: translucent bodies, a brighter nucleus, a soft
outer glow, subtle idle pulsing at a rate tied to `speed`.

- **Charging nucleus** grows with a visible membrane and orbiting
  offspring.
- **Collision flash** — a brief ring at the contact point, scaled by
  velocity. This is what couples the sound to the sight.
- **Death** is a slow fade and shrink, never a pop.
- Dark background so glow reads; colour is the only strong hue on screen.

No genetic-marker dots, no debug dashboard, no stats overlay in v1.

---

## 7. UI

Canvas dominates. One thin strip, four controls, nothing else:

```
┌──────────────────────────────────────────┐
│                                          │
│                 CANVAS                   │
│         (tap anywhere to begin)          │
│                                          │
├──────────────────────────────────────────┤
│  ♪ Key/Scale    ✦ Drift    ◧ Vol    ⟳    │
└──────────────────────────────────────────┘
```

- **Key/Scale** — pentatonic C / minor / one more
- **Drift** — mutation strength, 0 → "stays as you made it", high →
  "wanders". One knob, the whole evolution system's dial.
- **Vol** — master
- **⟳** — clear the canvas (fade all out; not a "reset", no fail state)

**First-run invitation:** a soft centred *"tap anywhere"* that fades on the
first pointer/key event and never returns. That line is doing spec-line-4's
job and unlocking the AudioContext in the same gesture.

---

## 8. Explicit non-goals

Named so no session quietly builds them:

- genetic crossover between two parents
- species detection / per-species musical roles
- energy, food, resource objects
- environmental zones of any kind
- multiple modes (sandbox / evolution / performance / garden)
- population statistics, lineage trees, evolutionary history views
- recording, export, save/share
- tempo grid and step quantization
- WebGL — Canvas 2D only
- any physics library — hand-rolled circle physics is enough

---

## 9. Architecture and module boundaries

Six modules, each one a GitHub issue and one Sonnet session.

```
  pointer / key events
          │
          ▼
   interaction  ──────────────┐
          │                   │
          ▼                   ▼
     simulation ──> genetics  │
          │                   │
     collisions               │
          │                   │
          ▼                   ▼
        audio  <──────────────┘
          │
    Web Audio API
```

| # | Module | Owns | Test-shaped acceptance criteria |
|---|--------|------|--------------------------------|
| 1 | `sim/` | organism state, integration, wall + pair collisions, spatial grid, lifespan, population cap | population never exceeds `MAX_POPULATION`; no pair tested twice per frame; dead organisms removed |
| 2 | `audio/` | AudioContext, scale quantizer, voice pool, envelopes, limiter | every emitted pitch is a member of the active scale; active voices never exceed the cap; context starts suspended |
| 3 | `genetics/` | genome type, inheritance, mutation, clamping, hue derivation | mutated genomes stay in bounds; `degree` mutates by whole steps; identical genomes derive identical hue |
| 4 | `interaction/` | pointer + keyboard grammar, charge/release, first-gesture resume, invite overlay | a tap emits a note in the same frame; hold emits a sustained voice; release emits ≥1 note per dispersed organism |
| 5 | `render/` | draw loop, glow, charge animation, collision flash, death fade | (visual — judged by eye, minimal tests) |
| 6 | shell | layout, control strip, head/meta, card, invariant + spec tests green | `pnpm check` green; invariants pass against `dist/` |

Issues 1–4 carry the invariants worth encoding as sensors. Issue 5 is
explicitly the one judged by looking, not testing.

---

## 10. Two-day plan

**Day 1 — it must be playable by end of day.**

1. `sim/` — canvas, organisms, physics, collisions, cap, lifespan
2. `audio/` — context, scale, voices, safety limits
3. `interaction/` — tap/hold/release + keyboard, first-gesture resume

End of day 1 target: *tap makes a note, hold swells, release throws a
chord, the cells keep playing.* That is already a passable C4 submission.
Everything after this is upside, and that ordering is deliberate — the
risky, spec-critical work happens while there's still a day of slack.

**Day 2 — make it feel alive, then ship.**

4. `genetics/` — inheritance, mutation, hue drift
5. `render/` — glow, charge animation, flashes, fades
6. shell — control strip, invite overlay, head/card, tests, deploy

Then: play it on a phone, play it on a laptop, hand it to someone without
saying anything and watch the first ten seconds. Write `PROCESS.md` and
`reflections/crit-4.md` from `learnings.md` as I go, not at the end.

---

## 11. Spec conformance — line by line

| Spec line | How this design satisfies it |
|-----------|------------------------------|
| deployed live on GitHub Pages by cutoff | day 2 ends with `/ship`; day 1 build is already shippable if day 2 goes wrong |
| browser is the instrument, sound made live | all synthesis is Web Audio, triggered by player gesture and physics; zero audio files |
| expressive; two players sound different | pitch from tap height, timbre from x, hold length → cluster size, drag → glide, Drift knob, key/scale — the state space is large and continuous |
| stranger plays it uninstructed | canvas is pitch-mapped from the first tap; "tap anywhere" invite; no mode to select first |
| mouse, keyboard or touch | Pointer Events (mouse+touch unified) and a keyboard voice with the same grammar |
| no way to play it wrong | pitch is a scale-degree index end to end; mutation moves in whole steps; no score, no fail, clear is a fade not a reset |
| starter invariant checks pass | shell issue owns `dist/` invariants; `pnpm check` green before every commit |
| repo evidences process | issues per subsystem, commits per issue, `learnings.md` → `PROCESS.md`, `reflections/crit-4.md` |
| account for how I directed the work | the Opus-plans / Sonnet-builds split in `CLAUDE.md`, with `/clear` between subsystems — the workflow *is* the story |

---

## 12. Success criterion

A stranger, given no explanation, within about fifteen seconds:

1. taps, and hears a note
2. taps somewhere else, and hears a different note — and works out why
3. holds, hears it swell, and lets go
4. grins at the chord
5. taps again *over the top of* what's still playing

If step 5 happens — if they play *with* the ecosystem instead of watching
it — the design is right. If they fold their hands and watch, it's an
aquarium and something above went wrong.

## 13. If there's time left over (in this order)

1. a light tempo grid, quantizing collisions to 16ths, as a toggle
2. multi-touch
3. a second instrument family (soft plucked string) selected by `brightness`
4. crossover on collision

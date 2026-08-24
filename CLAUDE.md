# COMP4020 prototype

Your starter repo for a COMP4020 prototype: a static site in HTML/CSS/TypeScript
that builds to plain HTML/CSS/JS and deploys to GitHub Pages. The deployed site
is what gets marked, not this repo.

The
[course website](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/)
publishes this deliverable's brief and spec, and this repo's name tells you
which deliverable applies. Read both before you plan or build.

## How to work in here

- Keep the dev server running (`pnpm dev`) so you see changes as you make them.
- Run `pnpm check` before you push.
- Open the page in a browser and look at it. The rendered page is the truth;
  your mental model of it isn't.
- When a check fails, read its output before you change anything.
- Never commit a red state.

## The link-preview card

`public/card.png` (1200x630) is the image a shared link shows; `index.html`'s
head points at it. Replace it and the `description` meta, and copy the head
block into any new page. The card URL resolves against the page that names it,
like any link --- `./card.png` is wrong one directory down, and nothing in CI
checks it, so look at the deployed head when you add pages.

## The checks

`pnpm check` runs them (`pnpm check:evidence` is the extra gate before you
ship); CI runs the same plus links, secrets and the deploy. Read the failure.

`spec/README.md`, `PROCESS.md` and `reflections/README.md` are in this repo and
say what they are for.

## Culture --- what this prototype is

An instrument you play by seeding life. A tap makes a sound *now*; the cell it
leaves behind keeps bouncing and keeps sounding, so the ecosystem is the
accompaniment the instrument leaves behind, not the instrument.

`plan.md` is the guide: design tokens, architecture, module contracts, and
every tuned constant. Read the relevant section before a build session, and
**do not invent a number** --- if a value isn't in `src/lib/constants.ts`, that
is a question, not a gap to fill.

### Rules that hold by construction

Three spec lines are true because of how the code is shaped, not because
someone was careful. Breaking the shape breaks the guarantee silently.

- **Pitch is an integer scale degree, everywhere.** Gesture, genome, mutation
  and events all speak degrees; `src/lib/audio/scales.ts` is the only module
  permitted to compute a frequency. This is what makes "no way to play it
  wrong" true. Sensor: `spec/audio.test.ts` greps `src/lib` for frequency
  maths outside `scales.ts`.
- **Colour is derived from the genome, never stored.** `inkOf(genome)` is a
  pure function, so a child looks different by exactly as much as it sounds
  different --- that is what makes evolution visible. An organism carrying its
  own colour field would let the two drift apart. Sensor:
  `spec/architecture.test.ts`.
- **The simulation makes no sound and no pixels.** `sim` returns events; the
  caller decides. That is the only reason the population and cooldown
  invariants can be tested headless. Sensor: `spec/architecture.test.ts`.

### Audio, which no check can hear

- Never assign a gain directly --- every change is a ramp, or it is a click.
- Voices are capped and stolen oldest-first, but **a held voice is never
  stolen** while an un-held one exists: the player's finger outranks the
  ambient collision.
- The `AudioContext` starts suspended and resumes inside a user-gesture
  handler. A tap must sound in the same handler as its `pointerdown`.
- `src/lib/audio/voices.ts` and `src/lib/sim/physics.ts` are **reference
  implementations**, not stubs. Their comments explain failure modes that look
  fine and sound wrong. Read before changing.

### Two traps

- The shipped invariants require a `<nav>` and exactly one `<h1>` on a page
  that is otherwise a full-bleed canvas. They are load-bearing --- do not tidy
  them away. See `plan.md` Issue 6.
- Dormant spec suites arm themselves when their module stops throwing
  `not implemented`. Before shipping run **`CULTURE_SHIP=1 pnpm check`**,
  which fails while any module is still a stub and lists which. A stub added
  without a line in `spec/support/dormant.ts`'s `SCAFFOLD` is invisible to
  that gate.

### Non-goals

No food, no predation, no species, no save/load, no charts, no settings panel,
no WebGL. Ideas that survive the crit go in `notes/idea.md` §13, not into the
build.

## Multi-model workflow

This crit uses Opus to plan and Sonnet to build, deliberately:

- **Opus plans once per crit** --- scope, module boundaries, GitHub issues
  (one per subsystem, criteria written test-shaped) --- then `/clear`
  before building starts. Don't carry Opus's planning back-and-forth into
  a build session as context it didn't ask for.
- **Sonnet builds one subsystem per session**, against `plan.md` and one
  issue at a time. `/clear` between subsystems, not one long session for
  the whole plan.
- **Never commit a red state** (see above) --- a failed `pnpm check` loops
  back into the same session, it doesn't get papered over.
- **Review runs in a fresh session** pointed at the diff, not a
  continuation of the build session. Escalate to Opus only when a bug
  looks architectural, not for routine fixes.
- **Harness changes (this file, skills, tests-as-sensors) get batched with
  Opus**, once real invariants exist --- not added ad hoc in whichever
  session happens to notice something.

Full reasoning in `notes/context-and-workflow-insights.md`; the flowchart
is at [Plan, Build, Ship](https://claude.ai/code/artifact/e31ab127-41fc-41a2-a3a0-f155996b6af8).

## This file is yours

A starting point, not a rulebook. As you learn what your prototype needs --- a
convention the work has to hold to, a sensor that keeps catching you out (a
linter, say), a fact about the stack that is easy to get wrong --- write it down
here and wire it into `check`. Growing this file is the work.

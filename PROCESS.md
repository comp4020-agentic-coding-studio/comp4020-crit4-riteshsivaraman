# Process overview

## What I built

The name of the website is **Culture**, an ecosystem-inspired instrument. The canvas simulates a simple cellular ecosystem where you can cells can move around, collide, reproduce, and eventually die.

A tap makes a sound, and the cell it leaves behind keeps bouncing and keeps sounding on every collision. The ecosystem is therefore the accompaniment the instrument leaves behind, not the instrument itself.

## The moments that mattered

1. **Letting Opus dispatch its own subagents instead of briefing each one myself.**

   I had five changes queued and had been opening a build session per issue by
   hand. Instead I gave the whole set to the Opus session that had written
   `plan.md` and let it spin the subagents off itself
   ([`dde2f92`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-riteshsivaraman/commit/dde2f92)). Because it had written the plan, it could
   hand each agent the context that mattered without me re-explaining it, and it
   worked out which issues could run at the same time by which files each one
   owned.

   What told me this was right, rather than just faster: three of them landed on
   the same commit timestamp (`8354573`, `0d61dc2` and `a7e18d3`), and every one
   of the five was a clean single-purpose commit. I had each agent verify
   narrowly with `vitest run` and `astro check`, because agents sharing a tree
   race on `dist/`, then ran the full `CULTURE_SHIP=1 pnpm check` myself once
   they had all landed, and read each diff
   ([`bde074c...091fa6b`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-riteshsivaraman/compare/bde074c...091fa6b)).

2. **The harness became a guide for how I work, not just how Claude works.**

   In the planning session I added a "Multi-model workflow" section to
   `CLAUDE.md`. Some of the instructions were to clear the context here, one subsystem per session, review in a
   fresh session etc. I asked Claude to turn it into a flowchart, which is how I
   checked the sequence held together before relying on it. Nearly every rule in
   it turned out to be an instruction to me, not to Claude, but I believe it was important for Claude to understand how I'd be working with it as a user. For example, it was conscious about the next steps, when context would be cleared, and where to look if not given enough context.

   The rule I was least sure of was "one subsystem per session". It held
   most places I followed it, where those sessions produced small commits that touched
   only their own module. In the initial planning stage, I had Opus divide the workload into six stage-based Github issues. However, Issue 5 was the exception: it ran far longer than any
   other and came out at 910 insertions across 12 files, reaching into
   `pointer.ts`, `physics.ts` and `constants.ts`, which the render work had no
   business changing ([`a1f585a`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-riteshsivaraman/commit/a1f585a)). That is what convinced me
   the problem was the issue rather than the rule. Opus had written one issue that
   was really three sessions of work. Sizing an issue to a session is a
   judgement I still have to make one at a time.

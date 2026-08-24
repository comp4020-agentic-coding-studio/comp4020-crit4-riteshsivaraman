import { describe, expect, it } from "vitest";
import { SCAFFOLD, stillStubbed } from "./support/dormant";

/**
 * The safety net under `describeWhenImplemented`.
 *
 * Suites sleep while their module is a stub so the repo is never red for
 * no reason. The risk that buys is worse than the problem it solves if a
 * dormant sensor can be mistaken for a passing one — so before shipping,
 * run:
 *
 *     CULTURE_SHIP=1 pnpm check
 *
 * and this fails if anything is still asleep. A green suite that tested
 * nothing is the exact failure the week-3 material warns about: a check
 * you have learned to trust that is not actually looking.
 *
 * It probes the modules directly rather than asking the other spec files
 * what they skipped: vitest isolates test files, so a shared registry
 * would read empty here and the gate would pass while every suite slept.
 */
describe("ship readiness", () => {
  it("has no unimplemented modules", () => {
    const stubs = stillStubbed();
    if (process.env.CULTURE_SHIP !== "1") {
      // Report, don't fail. Mid-build, stubs are the expected state.
      if (stubs.length > 0) {
        console.info(
          `\n  ${stubs.length}/${SCAFFOLD.length} still stubbed:\n    ${stubs.join("\n    ")}\n`,
        );
      }
      return;
    }
    expect(
      stubs,
      "these modules are still stubs — the site cannot ship with its sensors asleep",
    ).toEqual([]);
  });

  it("keeps the manifest honest", () => {
    // A stub missing from SCAFFOLD is invisible to the gate above, so the
    // manifest has to at least be non-empty and uniquely labelled.
    expect(SCAFFOLD.length).toBeGreaterThan(0);
    expect(new Set(SCAFFOLD.map((s) => s.label)).size).toBe(SCAFFOLD.length);
  });
});

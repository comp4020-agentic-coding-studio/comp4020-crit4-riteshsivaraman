import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { isStub } from "./support/dormant";

/**
 * The mechanically checkable half of the C4 spec, asserted against the
 * BUILT page.
 *
 * The other half — whether a gesture is expressive or just exhausting,
 * whether it sounds good — is what the crit is for, and nothing in this
 * file pretends otherwise. These check the contracts that would be
 * embarrassing to discover broken at the crit, not the quality.
 */

const DIST = resolve("dist/index.html");
const built = existsSync(DIST);
const doc = built ? new JSDOM(readFileSync(DIST, "utf8")).window.document : null;

// Dormant until the shell issue replaces the starter page.
const shellShipped =
  doc !== null && doc.querySelector("canvas") !== null;

const describeShell = shellShipped ? describe : describe.skip;

describeShell("C4 spec — the built page", () => {
  const page = doc as Document;

  it("is the instrument: a canvas, not an audio element (spec 2)", () => {
    expect(page.querySelector("canvas"), "no canvas — what does a stranger play?").toBeTruthy();
    expect(
      page.querySelectorAll("audio, video").length,
      "playback elements: sound must be made live in the page, not played back",
    ).toBe(0);
    expect(
      /\.(mp3|wav|ogg|m4a|flac)\b/i.test(page.documentElement.outerHTML),
      "an audio file is referenced; C4 is synthesis, not playback",
    ).toBe(false);
  });

  it("invites the first sound before anything is explained (spec 4)", () => {
    const invite = page.querySelector("[data-invite]");
    expect(invite, "no invite element — the opening screen has to ask for a tap").toBeTruthy();
    expect(invite?.textContent?.trim()).toMatch(/tap|touch|press|play/i);
  });

  it("teaches the pitch mapping in the invite, not in a tutorial", () => {
    // "higher is higher" is the whole instruction manual. If it goes, a
    // stranger has to discover the y-axis by accident.
    expect(page.querySelector("[data-invite]")?.textContent).toMatch(/higher/i);
  });

  it("offers the four controls, each with an accessible name (spec 5)", () => {
    for (const control of ["mood", "drift", "level", "clear"]) {
      const el = page.querySelector(`[data-control="${control}"]`);
      expect(el, `no ${control} control`).toBeTruthy();
      const name =
        el?.getAttribute("aria-label") ??
        el?.getAttribute("title") ??
        page.querySelector(`label[for="${el?.id}"]`)?.textContent ??
        el?.textContent;
      expect(name?.trim(), `${control} has no accessible name`).toBeTruthy();
    }
  });

  it("has no score, no timer, no fail state (spec 6)", () => {
    const text = page.body.textContent ?? "";
    expect(text).not.toMatch(/\bscore\b|\bgame over\b|\byou (win|lose)\b|\blives\b/i);
  });

  it("keeps the shipped invariants' nav and single h1", () => {
    // Called out because they are the two things a full-bleed canvas page
    // is most tempted to delete while tidying up. See plan.md Issue 6.
    expect(page.querySelector("nav"), "the invariants require a nav landmark").toBeTruthy();
    expect(page.querySelectorAll("h1").length).toBe(1);
  });

  it("stops the canvas from being scrolled away on touch", () => {
    const css = page.querySelector("style")?.textContent ?? "";
    const linked = [...page.querySelectorAll('link[rel="stylesheet"]')].length > 0;
    expect(
      /touch-action\s*:\s*none/.test(css) || linked,
      "canvas needs touch-action: none or mobile scroll eats every drag",
    ).toBe(true);
  });

  it("replaced the template's description and card", () => {
    const description = page
      .querySelector('meta[name="description"]')
      ?.getAttribute("content");
    expect(description).toBeTruthy();
    expect(description, "still the template placeholder").not.toMatch(/Replace this with/i);
  });
});

if (!shellShipped) {
  describe("C4 spec — the built page", () => {
    it.skip(`dormant: ${built ? "no canvas yet" : "run pnpm build first"} — see plan.md Issue 6`, () => {});
  });
}

export { isStub };

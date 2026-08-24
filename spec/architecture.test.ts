import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The dependency rule as a sensor.
 *
 * plan.md §3 says the simulation never reaches into audio or render — it
 * returns events and the caller decides. That rule is the only reason the
 * population and cooldown invariants can be tested headless in
 * milliseconds, so it is worth more than a sentence in a document that a
 * build session may or may not re-read.
 *
 * This is prose turned into a check, which is the point: a rule nobody
 * enforces is a rule that erodes on the first convenient afternoon.
 */

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });

const sources = walk("src/lib").filter((path) => path.endsWith(".ts"));
const read = (path: string) => readFileSync(path, "utf8");

/**
 * Source with comments removed.
 *
 * The colour sensor below greps for the word, and the sim modules are
 * *documented* as carrying no colour. Grepping raw text there punishes the
 * comment that states the rule — which teaches the next session to delete
 * the comment rather than keep the rule. Strip prose, check code.
 */
const code = (path: string) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

const importsFrom = (source: string, module: string) =>
  new RegExp(`from\\s+["'][^"']*\\b${module}(/[^"']*)?["']`).test(source);

describe("module boundaries", () => {
  it("sim depends on nothing but genetics and constants", () => {
    for (const path of sources.filter((p) => p.includes("/sim/"))) {
      const source = read(path);
      for (const forbidden of ["audio", "render", "interaction"]) {
        expect(
          importsFrom(source, forbidden),
          `${path} imports ${forbidden} — sim emits events, it does not make sound or pixels`,
        ).toBe(false);
      }
    }
  });

  it("genetics depends on nothing but constants and the scale span", () => {
    for (const path of sources.filter((p) => p.includes("/genetics/"))) {
      const source = read(path);
      for (const forbidden of ["sim", "render", "interaction"]) {
        expect(importsFrom(source, forbidden), `${path} imports ${forbidden}`).toBe(false);
      }
    }
  });

  it("audio depends on nothing but constants", () => {
    for (const path of sources.filter((p) => p.includes("/audio/"))) {
      const source = read(path);
      for (const forbidden of ["sim", "render", "interaction", "genetics"]) {
        expect(importsFrom(source, forbidden), `${path} imports ${forbidden}`).toBe(false);
      }
    }
  });

  it("keeps colour out of the simulation — ink is derived (I7)", () => {
    for (const path of sources.filter((p) => p.includes("/sim/"))) {
      expect(
        /\b(hue|colou?r|rgb|hsl)\b/i.test(code(path)),
        `${path} mentions colour; organisms carry a genome, and ink is derived from it`,
      ).toBe(false);
    }
  });

  it("keeps every tuned number in constants.ts", () => {
    // Not a style rule: the ★ values were set by ear, and a literal
    // inlined at a call site is a number nobody will think to re-listen to.
    const offenders = sources
      .filter((p) => !p.endsWith("constants.ts"))
      .filter((p) =>
        /\bMAX_POPULATION\s*=|VOICE_CAP\s*=|COLLISION_COOLDOWN_MS\s*=/.test(code(p)),
      );
    expect(offenders).toEqual([]);
  });
});

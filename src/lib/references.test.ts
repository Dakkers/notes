import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadEnv } from "vite";
import { describe, expect, it } from "vitest";

import { SOURCES } from "./references";

// Where the notes come from, mirroring `.config/vite.config.ts`: the real vault via
// `NOTES_DIR`/`EMBEDS_DIR` in `.config/.env.local` when present (so locally this
// guards the live vault), else the committed `.demo` fixtures (so CI — which has no
// `.env.local` — still runs the test, against the fixtures).
const repoRoot = resolve(import.meta.dirname, "..", "..");
const env = loadEnv("development", join(repoRoot, ".config"), "");
const noteDirs = [env.NOTES_DIR || join(repoRoot, ".demo"), env.EMBEDS_DIR].filter(
  (dir): dir is string => typeof dir === "string" && dir !== "",
);

// Every `[[Sources/<short-form>…]]` citation, capturing the short form: the segment
// after `Sources/` and before any `|alias`, `#heading`, `^block`, or closing `]]`.
const SOURCE_CITATION_RE = /\[\[\s*Sources[\\/]+([^\]|#^]+)/gi;

/** Top-level `.md` files of a dir (non-recursive, matching the notes plugin's scan);
 *  a dir that isn't present (e.g. an unset `EMBEDS_DIR`) contributes nothing. */
function markdownFiles(dir: string): { path: string; raw: string }[] {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  return names
    .filter((name) => name.endsWith(".md"))
    .map((name) => ({ path: join(dir, name), raw: readFileSync(join(dir, name), "utf8") }));
}

/** Every source citation across the notes, tagged with the file it came from. */
function citations(): { shortForm: string; file: string }[] {
  const found: { shortForm: string; file: string }[] = [];
  for (const dir of noteDirs) {
    for (const { path, raw } of markdownFiles(dir)) {
      for (const match of raw.matchAll(SOURCE_CITATION_RE)) {
        found.push({ shortForm: match[1].trim(), file: path });
      }
    }
  }
  return found;
}

describe("references table", () => {
  it("gives every source a unique short form", () => {
    const shortForms = SOURCES.map((source) => source.shortForm);
    expect(new Set(shortForms).size).toBe(shortForms.length);
  });

  it("has a row for every `[[Sources/…]]` citation the notes make", () => {
    const known = new Set(SOURCES.map((source) => source.shortForm));
    const orphans = citations().filter((cite) => !known.has(cite.shortForm));
    // A citation to a short form with no row would render as a dead `/references#…`
    // link. List the offenders so the fix (add the row, or correct the link) is obvious.
    expect(orphans.map((orphan) => `${orphan.shortForm} — cited in ${orphan.file}`)).toEqual([]);
  });
});

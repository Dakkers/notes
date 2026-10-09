// Regenerates `src/lib/references.gen.ts` from the vault's `Sources` folder
// (`SOURCES_DIR` in `.config/.env*`).
//
//   --check     Write nothing; exit non-zero if the committed file is stale.
//   --optional  Exit quietly when `SOURCES_DIR` is unset (for the pre-commit hook).

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { loadEnv } from "vite";

import { parseSource, renderSourcesModule } from "../src/lib/references.ts";

const OUTPUT = "src/lib/references.gen.ts";

const args = new Set(process.argv.slice(2));
const check = args.has("--check");
const optional = args.has("--optional");

const { SOURCES_DIR } = loadEnv("production", ".config", "");

if (!SOURCES_DIR) {
  if (optional) process.exit(0);
  console.error("SOURCES_DIR is not set. Set it in .config/.env.local (see README).");
  process.exit(1);
}

const sources = readdirSync(SOURCES_DIR)
  .filter((name) => name.endsWith(".md"))
  .flatMap((name) => parseSource(name, readFileSync(join(SOURCES_DIR, name), "utf8")) ?? []);
const next = renderSourcesModule(sources);

let current = "";
try {
  current = readFileSync(OUTPUT, "utf8");
} catch {}

if (check) {
  if (current !== next) {
    console.error(`${OUTPUT} is out of date with ${SOURCES_DIR}.`);
    console.error("Run `pnpm references` and commit the result.");
    process.exit(1);
  }
  process.exit(0);
}

if (current !== next) {
  writeFileSync(OUTPUT, next);
  console.log(`Wrote ${sources.length} sources to ${OUTPUT}.`);
}

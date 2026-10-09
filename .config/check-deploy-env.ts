// Guards `pnpm run deploy` against shipping the `.demo` fixtures. Exits non-zero
// unless `NOTES_DIR` is set in `.config/.env*` and every vault path that is set
// (`NOTES_DIR`, `ATTACHMENTS_DIR`, `EMBEDS_DIR`, `SOURCES_DIR`) is an existing directory.

import { statSync } from "node:fs";

import { loadEnv } from "vite";

const VAULT_VARS = ["NOTES_DIR", "ATTACHMENTS_DIR", "EMBEDS_DIR", "SOURCES_DIR"] as const;

const env = loadEnv("production", ".config", "");

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

const problems: string[] = [];

if (!env.NOTES_DIR) {
  problems.push("NOTES_DIR is not set, so the build would publish the .demo notes.");
}

for (const name of VAULT_VARS) {
  const path = env[name];
  if (path && !isDirectory(path)) {
    problems.push(`${name} points at ${path}, which is not a directory.`);
  }
}

if (problems.length > 0) {
  console.error("Refusing to deploy:");
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error("Set the vault paths in .config/.env.local (see README).");
  process.exit(1);
}

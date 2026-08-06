import { defineConfig, loadEnv } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";

import { demoNotes } from "../src/lib/notes/plugin";

// This file lives in `.config/`, but Vite's `root` stays the project root — it
// defaults to the cwd, not to the config file's directory. So any project-
// relative paths below are written relative to the project root.
//
// `tanstackStart()` wires up SSR + the file-based router; `viteReact()` adds
// Fast Refresh. The `#/*` path alias comes from tsconfig via `tsconfigPaths`.
export default defineConfig(({ mode }) => {
  // `NOTES_DIR` (an absolute path in `.config/.env.local`, gitignored) points the
  // notes plugin at a real vault; without it, the committed `.demo` fixtures are
  // used. `ATTACHMENTS_DIR` likewise points at the vault's image attachments folder
  // (Obsidian's "Files" dir); without it, image embeds simply don't resolve. Load
  // with an empty prefix so these Node-side vars need not be `VITE_`-prefixed.
  const { NOTES_DIR, ATTACHMENTS_DIR } = loadEnv(mode, ".config", "");

  return {
    // `.env*` files live alongside this config rather than in the project root.
    envDir: ".config",
    resolve: { tsconfigPaths: true },
    // `cloudflare()` targets the SSR build at the Workers runtime and serves the
    // app through workerd in dev; it must come first (Cloudflare's requirement).
    // `demoNotes()` then parses the notes dir into `virtual:demo-notes` (see the
    // plugin for how this straddles dev and build) — kept ahead of the app plugins
    // so the virtual module is resolvable everywhere they render. `viteEnvironment`
    // maps the Worker onto TanStack Start's `ssr` environment.
    plugins: [
      cloudflare({ viteEnvironment: { name: "ssr" } }),
      demoNotes({ dir: NOTES_DIR || undefined, attachmentsDir: ATTACHMENTS_DIR || undefined }),
      tanstackStart(),
      viteReact(),
    ],
  };
});

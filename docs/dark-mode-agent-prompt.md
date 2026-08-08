# Task: Implement a coherent dark mode for the app

You are implementing a real, app-wide dark mode for this TanStack Start + React +
Baritone site. Today the app is **light-only**, with a couple of ad-hoc partial
dark overrides bolted on that don't actually work together. Your job is to make
one coherent theming system that flips the *entire* UI — Baritone chrome and the
hand-rolled note prose alike — between light and dark.

Work in small, verified steps. Read the referenced files before changing them,
and verify in the running app (see **Verification**) rather than assuming.

---

## Confirm one decision before you start

How should the theme be chosen? This changes the mechanism, so confirm with the
user (or, if working autonomously, take the **recommended** option and say so):

- **(A) Follow the OS only** — `prefers-color-scheme`, no UI control. Simplest.
- **(B) Manual toggle only** — a control in the app, persisted; ignores the OS.
- **(C) Manual toggle, defaulting to the OS (recommended)** — a control in the
  nav that overrides the OS preference and persists the choice; when the user has
  made no choice, follow the OS.

The rest of this brief assumes **(C)**. If (A) is chosen, you can skip the toggle
UI, persistence, and no-flash script, and drive everything off the media query —
but you must still give Baritone a dark token set (it does **not** respond to the
media query on its own; see below).

---

## How theming works today (ground truth — verify as you go)

**Baritone is mounted light-only.**
- `src/routes/__root.tsx:36` renders `<BaritoneTheme tokens={tokens} scheme="light" render={<body />}>`.
- `tokens` comes from `buildAppTokens()` in `src/lib/theme.ts`, which is hardcoded
  to `buildDefaultTokens("light")`.
- Baritone's API (verified in its `.d.ts`):
  `buildDefaultTokens(scheme: "light" | "dark", brand?)` returns a token set, and
  `BaritoneTheme` requires **matching** `tokens` **and** `scheme` props. Theme
  scopes nest, and the component only supplies token *values* (the compiled
  `styles.css` is imported once in `src/styles/styles.css`). **Baritone has no
  awareness of `prefers-color-scheme`** — the scheme is whatever prop you pass.

**Baritone design tokens auto-follow the mounted scheme.**
- `src/components/NoteBody.tsx` bridges Baritone intent tokens into CSS variables
  for callouts via `vars.surface.color[intent]...` (e.g. `--cx-primary-bg`).
  Because `vars.*` are references to the custom properties `BaritoneTheme` sets,
  **this bridge will automatically resolve to dark values once a dark scheme is
  mounted — no change needed here**, but you must re-verify callout contrast in dark.

**The note prose has its own hand-rolled palette with a partial dark override.**
- `src/styles/prose.css` defines a `--prose-*` palette (`--prose-fg`, `-muted`,
  `-accent`, `-rule`, `-code-bg`) around line 8–16 and 166–170, with a
  `@media (prefers-color-scheme: dark)` block near **line 440** that swaps them.
- `src/styles/references.css` does the same with `--ref-*` and its own
  `@media (prefers-color-scheme: dark)` block near **line 43**.
- These flip on the OS media query **only**, so with option (C)'s manual override
  they'd desync from Baritone (which is driven by a prop). This is the core
  breakage to fix: **prose/references must switch on the same signal as Baritone**,
  not on `prefers-color-scheme` alone.

**There is a light-pin hack to remove.**
- `src/styles/prose.css` `.prose .callout { ... }` currently pins `--prose-*` to
  light hex values (with a comment explaining it exists *only because Baritone is
  light-only*). Once a real dark scheme is mounted, this makes callout text
  light-on-dark-pinned-light — wrong. **Remove/rework this block** and let callouts
  inherit the active prose palette + Baritone tokens. Re-verify callout readability
  in both modes afterward.

**SSR specifics.**
- TanStack Start SSR; `src/routes/__root.tsx` renders `<html lang="en"
  suppressHydrationWarning>` and links `reset.css` then `styles.css` in `head`.
- Anything theme-related rendered on the server must not mismatch the client on
  hydration, and there must be **no flash** of the wrong theme before paint.

---

## What to build (assuming option C)

1. **A single source of truth for the active scheme.**
   - Effective scheme = persisted user choice (`localStorage`) ?? OS preference.
   - Reflect it as `data-theme="light" | "dark"` on `<html>` (a stable, explicit
     signal that both Baritone and CSS can key off — do **not** rely on the media
     query once a manual override exists).

2. **No-flash inline script.** Inject a tiny blocking script in `<head>` (before
   body renders) that reads `localStorage` / OS and sets `data-theme` on the
   documentElement synchronously. This prevents FOUC and keeps SSR markup neutral
   so hydration stays consistent (lean on the existing `suppressHydrationWarning`).

3. **Drive Baritone from the active scheme.**
   - Build both token sets once (`buildDefaultTokens("light")` and `("dark")`),
     e.g. extend `src/lib/theme.ts`.
   - In `__root.tsx`, pass the active scheme's `tokens` **and** matching `scheme`
     to `BaritoneTheme`, derived from theme state. Pick an SSR default (follow the
     no-flash script's result) and update on the client after hydration.

4. **Unify the prose + references palettes with the toggle.**
   - Make `--prose-*` (`prose.css`) and `--ref-*` (`references.css`) respond to
     `:root[data-theme="dark"]` (and, if you keep OS-follow as the default,
     *also* `@media (prefers-color-scheme: dark)` scoped to the no-explicit-choice
     case). Prefer one mechanism consistently.
   - **Better, if practical:** derive these palette values from Baritone tokens
     (`vars.*`) so there's a single source of truth and they can never desync.
     Evaluate this vs. keeping curated hex ramps; note the trade-off in a comment.

5. **Remove the callout light-pin** (see above) and re-verify callouts.

6. **A toggle control** in `src/components/NavBar.tsx` (assuming C/B). Use a
   Baritone `Button`/`ToggleButton` with a lucide `Sun`/`Moon` icon (the project
   already uses `lucide-react`), an accessible label, and wire it to the theme
   state. Respect `prefers-reduced-motion` for any color transition.

---

## Constraints & gotchas

- **No FOUC, no hydration mismatch.** The server can't know the client's stored
  choice; the inline script + `suppressHydrationWarning` is the standard fix. Keep
  server output theme-neutral and let the script + client state settle it.
- **One signal.** Baritone (prop) and the CSS palettes must key off the *same*
  effective scheme. Mixing a manual toggle with `@media`-only CSS is exactly the
  current bug — don't reproduce it.
- **Don't ship extra weight to the client.** No new heavy deps; the markdown
  pipeline stays build-time only.
- **Keep it accessible.** Toggle has a label/`aria`, focus-visible ring intact,
  and contrast passes in both modes (Baritone tokens are contrast-checked; the
  hand-rolled prose/reference colors are your responsibility).

---

## Verification (do this, don't ask the user to)

Use the in-app preview browser tools — **never** start a dev server via shell.

1. `preview_start` with `{ name: "dev" }` (config in `.claude/launch.json`, port 3000).
2. Exercise **both** schemes (toggle in-app, and emulate OS via `resize_window`
   `colorScheme`) across these routes:
   - `/` (home), `/notes` (combobox + chips), `/references`, `/about`.
   - A note page that exercises the hard cases — **callouts, `![[embeds]]`,
     footnotes (side panel), KaTeX math, and images/lightbox**. Good sample:
     `/notes/20221007175600`.
3. Confirm, in dark mode: nav/sidebar/side-panel chrome is dark; prose body text,
   links, code, tables, blockquotes, footnotes, and callouts all have adequate
   contrast; the lightbox and chips look right.
4. Toggle back and forth; reload; confirm the choice persists and there's **no
   flash** on reload.
5. `read_console_messages` (errors only) — expect none, **including no React
   hydration warnings**.
6. Run `npx tsc --noEmit` and `npx vitest run` — both clean.
7. Screenshot both modes on the sample note page as proof.

---

## Likely files to touch

- `src/lib/theme.ts` — build both token sets; expose active selection.
- `src/routes/__root.tsx` — no-flash script, drive `BaritoneTheme` from state.
- `src/components/NavBar.tsx` — toggle control.
- `src/styles/prose.css` — palette keyed to `data-theme`; remove callout light-pin.
- `src/styles/references.css` — palette keyed to `data-theme`.
- Possibly a small `ThemeProvider`/hook module for the client state + persistence.
- `src/components/NoteBody.tsx` — likely **no change** (verify the callout bridge
  in dark), unless you choose to derive prose colors from Baritone tokens.

## Out of scope (unless asked)

Per-note themes, a high-contrast mode, themed favicons/OG images, or animating the
whole-page transition beyond a simple, reduced-motion-safe color fade.

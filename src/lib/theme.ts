/**
 * The app's Baritone theme, in one place so every mount point paints with the
 * same tokens. The document root (`routes/__root.tsx`) injects it for the real app.
 *
 * `buildDefaultTokens` derives the whole system — surfaces, the intent ramps
 * (fills, tints, borders, focus rings) and the three text saliencies, each
 * contrast-checked against its surface — from Baritone's built-in defaults. To
 * rebrand, pass a seed as the second argument, e.g.
 * `buildDefaultTokens("light", { intents: { primary: { h: 34, c: 0.2 } } })`.
 */
import { buildDefaultTokens, createInlineTheme } from "@saintly-software/baritone";

const THEME_SELECTOR = "body";

function declarations(vars: Record<string, string>): string {
  return Object.entries(vars)
    .map(([name, value]) => `${name}:${value};`)
    .join("");
}

/**
 * Stylesheet text that themes `body` in the light scheme and switches to the
 * dark scheme when the visitor's OS prefers it. Pure CSS, so the server-rendered
 * page paints in the right scheme on first paint.
 */
export function buildThemeCss(): string {
  const light = createInlineTheme(buildDefaultTokens("light"), { scheme: "light" });
  const dark = createInlineTheme(buildDefaultTokens("dark"), { scheme: "dark" });
  const darkOnly = Object.fromEntries(Object.entries(dark).filter(([k, v]) => light[k] !== v));

  return [
    `${THEME_SELECTOR}{isolation:isolate;color-scheme:light dark;${declarations(light)}}`,
    `@media (prefers-color-scheme: dark){${THEME_SELECTOR}{${declarations(darkOnly)}}}`,
  ].join("\n");
}

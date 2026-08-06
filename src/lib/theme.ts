/**
 * The app's Baritone theme, in one place so every mount point paints with the
 * same tokens. The document root (`routes/__root.tsx`) uses it for the real app.
 *
 * `buildDefaultTokens` derives the whole system — surfaces, the intent ramps
 * (fills, tints, borders, focus rings) and the three text saliencies, each
 * contrast-checked against its surface — from Baritone's built-in defaults. To
 * rebrand, pass a seed as the second argument, e.g.
 * `buildDefaultTokens("light", { intents: { primary: { h: 34, c: 0.2 } } })`.
 */
import { buildDefaultTokens } from "@saintly-software/baritone";

export function buildAppTokens() {
  return buildDefaultTokens("light");
}

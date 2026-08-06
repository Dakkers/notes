/**
 * Display-time tag filtering and colour. Some Obsidian tag namespaces are
 * organizational only and shouldn't surface in the public UI; others map to a
 * Baritone intent so their chips paint in a consistent colour. This is the
 * single place that decides both, so filters, note lists, and note pages agree.
 */

import type { Intent } from "@saintly-software/baritone";

/**
 * Hidden tag namespaces (case-insensitive). A tag is hidden when it equals one
 * of these or nests beneath it, so `Meta` hides `Meta`, `Meta/foo`, and
 * `Meta/a/b` alike.
 */
const HIDDEN_NAMESPACES = ["Meta"];

/**
 * Colour intent per top-level tag namespace (case-insensitive). A tag inherits
 * the intent of its root segment, so `Music/Harmony` and `Music/Jazz` both paint
 * with `Music`'s intent. Tags outside these namespaces fall back to
 * {@link DEFAULT_TAG_INTENT}.
 */
const NAMESPACE_INTENTS: Record<string, Intent> = {
  music: "primary",
  dev: "secondary",
  audioengineering: "positive",
};

/** Intent for tags whose namespace isn't in {@link NAMESPACE_INTENTS}. */
const DEFAULT_TAG_INTENT: Intent = "neutral";

/**
 * The Baritone intent a tag's chip should paint with, keyed on its top-level
 * namespace so every child inherits its parent's colour (`Music/Harmony` →
 * `Music`'s intent). Unmapped namespaces get {@link DEFAULT_TAG_INTENT}.
 */
export function tagIntent(tag: string): Intent {
  const root = tag.split("/", 1)[0].toLowerCase();
  return NAMESPACE_INTENTS[root] ?? DEFAULT_TAG_INTENT;
}

/** True when `tag` belongs to a hidden namespace. */
export function isHiddenTag(tag: string): boolean {
  const lower = tag.toLowerCase();
  return HIDDEN_NAMESPACES.some((ns) => {
    const nsLower = ns.toLowerCase();
    return lower === nsLower || lower.startsWith(`${nsLower}/`);
  });
}

/** Drop hidden-namespace tags, preserving first-seen order. */
export function visibleTags(tags: string[]): string[] {
  return tags.filter((tag) => !isHiddenTag(tag));
}

import type { Backlink, Note, OutgoingLink } from "./types";

/**
 * Resolve a wikilink target (a note name or Zettelkasten id, possibly with a
 * `#heading` / `#^block` suffix) to a route slug, or null if it isn't in the vault.
 */
export type ResolveTarget = (target: string) => string | null;

/** Case-insensitive lookup from a note's name *or* id to its slug — how Obsidian matches `[[links]]`. */
export function buildResolver(notes: readonly Note[]): ResolveTarget {
  const slugByRef = new Map<string, string>();
  for (const note of notes) {
    slugByRef.set(note.name.toLowerCase(), note.slug);
    if (note.id !== null) slugByRef.set(note.id.toLowerCase(), note.slug);
  }
  return (target) => {
    // Match the note part only, dropping any `#heading` / `#^block` suffix.
    const key = target.split(/[#^]/, 1)[0].trim().toLowerCase();
    if (key === "") return null;
    const direct = slugByRef.get(key);
    if (direct !== undefined) return direct;
    // Obsidian also resolves a path-qualified target (`[[Folder/Note]]`) by its
    // basename, so `![[Embed/Caplin Ahead!]]` still finds the note "Caplin Ahead!".
    const base = key.split(/[\\/]/).pop() ?? key;
    return base === key ? null : (slugByRef.get(base) ?? null);
  };
}

/**
 * Fill each note's `backlinks` by inverting every note's outgoing links: a note
 * B that links to A becomes one of A's backlinks. Mutates the notes in place.
 * Unresolved targets and self-references are skipped, and a source that links to
 * the same note more than once is listed once.
 */
export function attachBacklinks(notes: readonly Note[], resolve: ResolveTarget): void {
  const bySlug = new Map<string, Backlink[]>();

  for (const source of notes) {
    const seen = new Set<string>();
    for (const link of source.links) {
      const targetSlug = resolve(link.target);
      if (targetSlug === null || targetSlug === source.slug || seen.has(targetSlug)) continue;
      seen.add(targetSlug);

      let list = bySlug.get(targetSlug);
      if (list === undefined) bySlug.set(targetSlug, (list = []));
      list.push({ slug: source.slug, title: source.title });
    }
  }

  for (const note of notes) {
    note.backlinks = (bySlug.get(note.slug) ?? []).sort((a, b) =>
      a.title.localeCompare(b.title, undefined, { sensitivity: "base" }),
    );
  }
}

/**
 * Fill each note's `outgoingLinks` — the in-vault notes it links *to* — by
 * resolving its wikilinks. The mirror image of {@link attachBacklinks}. Unresolved
 * targets (links to notes not in the vault) and self-references are skipped, a
 * note linked more than once is listed once, and document order is preserved (the
 * order the links appear in the note). Mutates the notes in place.
 */
export function attachOutgoingLinks(notes: readonly Note[], resolve: ResolveTarget): void {
  const bySlug = new Map(notes.map((note) => [note.slug, note]));

  for (const source of notes) {
    const seen = new Set<string>();
    const outgoingLinks: OutgoingLink[] = [];
    for (const link of source.links) {
      const targetSlug = resolve(link.target);
      if (targetSlug === null || targetSlug === source.slug || seen.has(targetSlug)) continue;
      seen.add(targetSlug);

      const target = bySlug.get(targetSlug);
      if (target !== undefined) outgoingLinks.push({ slug: target.slug, title: target.title });
    }
    source.outgoingLinks = outgoingLinks;
  }
}

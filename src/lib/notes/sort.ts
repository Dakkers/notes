// Characters ignored when ordering note titles, so a title sorts by its letters
// rather than by leading punctuation or a symbol:
//  - quotes (straight and curly, single and double) — `"Cadence" vs …` files under C;
//  - the degree sign `°` (and its ordinal look-alike `º`) — `°7 chords` files as
//    `7 chords`, next to the other number-led notes rather than stranded near "o".
// Titles can come from frontmatter (see `#/lib/notes/parse`), which may legitimately
// open with a character the filename itself couldn't carry.
const IGNORED_RE = /["'“”‘’°º]/g;

function sortKey(title: string): string {
  return title.replace(IGNORED_RE, "");
}

/** Order note titles alphabetically, ignoring case, accents, quotes, and degree signs. */
export function byTitle(a: { title: string }, b: { title: string }): number {
  return sortKey(a.title).localeCompare(sortKey(b.title), undefined, { sensitivity: "base" });
}

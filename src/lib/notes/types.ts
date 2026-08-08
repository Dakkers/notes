/**
 * Metadata schema for a single `.demo` note, plus the ambient type for the
 * `virtual:demo-notes` module that ships the parsed collection to the app.
 *
 * The parse step (`#/lib/notes/parse`) and the Vite plugin (`#/lib/notes/plugin`)
 * both produce these shapes; the app only ever sees metadata — the raw markdown
 * body stays on the build machine and never reaches the client bundle.
 */

/** An outgoing Obsidian link: `[[target]]`, `[[target|alias]]`, or `![[embed]]`. */
export interface NoteLink {
  /** The linked note's identity (its filename without `.md`), before any `|`. */
  target: string;
  /** Display text after `|`, when the link overrides its label. */
  alias?: string;
  /** `true` for transclusions written as `![[...]]`. */
  embed: boolean;
}

/** An incoming reference: another note whose `[[link]]`/`![[embed]]` resolves here. */
export interface Backlink {
  /** The referencing note's route slug. */
  slug: string;
  /** The referencing note's title. */
  title: string;
}

/** An outgoing link: a note this one links *to* via a resolved `[[link]]`/`![[embed]]`. */
export interface OutgoingLink {
  /** The linked note's route slug. */
  slug: string;
  /** The linked note's title. */
  title: string;
}

export interface Note {
  /** Full filename including extension, e.g. `"20220403105600 Harmony definition.md"`. */
  fileName: string;
  /** Filename without extension — Obsidian's note identity for `[[links]]`. */
  name: string;
  /** Zettelkasten timestamp id from the filename prefix (`"20220403105600"`), or null. */
  id: string | null;
  /** Stable, URL-safe route key (`/notes/$slug`): the `id`, or a slugified `name`. */
  slug: string;
  /** Readable title: the filename minus the id prefix, falling back to `name`. */
  title: string;
  /** Parsed YAML frontmatter (the `---` block), or `{}` when the note has none. */
  frontmatter: Record<string, unknown>;
  /** First markdown `#` heading in the body, if any. */
  heading: string | null;
  /** Outgoing `[[wikilinks]]` and `![[embeds]]`, in document order. */
  links: NoteLink[];
  /**
   * Notes that link *to* this one. Empty out of {@link parseNote} (a per-note
   * pass can't see the graph); the plugin fills it in a cross-note step.
   */
  backlinks: Backlink[];
  /**
   * The distinct in-vault notes this one links to (its {@link links} resolved to
   * real notes, in document order). Like {@link backlinks}, it needs the whole
   * vault, so it's empty out of {@link parseNote} and filled by the plugin.
   */
  outgoingLinks: OutgoingLink[];
  /**
   * Distinct tags in first-seen order: inline `#tags` (emoji included) unioned
   * with any frontmatter `tags`, mirroring how Obsidian merges the two.
   */
  tags: string[];
  /** Rough word count of the prose body (code blocks excluded). */
  wordCount: number;
  /**
   * True when the body (after frontmatter) is blank — a stub note that exists as
   * a `[[link]]` target but hasn't been written yet. Empty notes are hidden from
   * the sidebar and listings, but stay reachable via their backlinks, where the
   * page shows a "not written yet" placeholder instead of an empty article.
   */
  empty: boolean;
}

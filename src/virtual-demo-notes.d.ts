// Ambient declaration for the `virtual:demo-notes` module produced by the
// `demoNotes()` Vite plugin (`#/lib/notes/plugin`). Kept in a `.d.ts` — a
// `declare module` in a regular `.ts` module reads as an augmentation and fails
// to resolve, since the virtual id has no on-disk file to augment.
declare module "virtual:demo-notes" {
  /** Parsed `.demo` notes, sorted by filename. Populated at dev-server start and build. */
  export const notes: import("./lib/notes/types").Note[];
}

// Rendered note bodies, kept in a *separate* module so importing note metadata
// (the sidebar) doesn't pull every note's tree into that bundle — only the note
// page route imports this.
declare module "virtual:demo-notes/content" {
  /**
   * Rendered body per note as a hast tree (HTML AST), keyed by {@link Note.slug}.
   * The app turns it into React via `#/components/NoteBody` so `[[wikilinks]]`
   * become real router links.
   */
  export const content: Record<string, import("hast").Root>;

  /**
   * Footnote definitions per note as a hast `<ol>` tree, keyed by {@link Note.slug}
   * — present only for notes that have footnotes. Rendered in the note's side panel
   * (see `#/components/NoteInfoPanel`); the body's `[^n]` markers anchor to them.
   */
  export const footnotes: Record<string, import("hast").Root>;

  /**
   * The verbatim `.md` source per note, keyed by {@link Note.slug} — the exact
   * text the build-time renderer consumed. Powers the "view raw markdown" modal
   * in the note's side panel (see `#/components/NoteInfoPanel`).
   */
  export const raw: Record<string, string>;
}

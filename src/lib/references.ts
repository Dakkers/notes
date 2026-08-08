/**
 * The bibliography behind the notes. These live in the Obsidian vault's `Sources`
 * folder, which the notes plugin doesn't ingest (it scans only the top-level notes
 * dir), so the curated list is mirrored here and rendered by `#/routes/references`.
 *
 * Each entry's {@link Source.shortForm} is the exact filename (sans `.md`) of its
 * `Sources/…` note in the vault, so an inline `[[Sources/caplin-1998]]` citation
 * resolves to that source's row on the References page — the renderer routes such
 * links to `/references#<shortForm>` (see `#/lib/notes/render`), and
 * `references.test.ts` asserts every cited short form has a row here.
 *
 * Kept sorted by author surname (which, given the `surname-year` short forms, keeps
 * the short-form column sorted too).
 */
export interface Source {
  /**
   * The `[[Sources/<short-form>]]` slug the notes cite this source by, e.g.
   * `"caplin-1998"`. Must equal the vault filename and is the row's anchor id, so a
   * citation targets `/references#caplin-1998`. Unique across sources.
   */
  shortForm: string;
  /** Author(s), in citation order, e.g. `"Caplin, William"`. */
  author: string;
  /** Title of the work, rendered italic; becomes a link when {@link url} is set. */
  title: string;
  /** Trailing publication details: edition, publisher, year. */
  publication: string;
  /** Canonical URL for online sources. */
  url?: string;
  /** ISBN, when noted in the source. */
  isbn?: string;
}

export const SOURCES: Source[] = [
  {
    shortForm: "belkin-2018",
    author: "Belkin, Alan",
    title: "Music Composition: Craft and Art",
    publication: "Yale University Press, 2018.",
  },
  {
    shortForm: "caplin-1998",
    author: "Caplin, William",
    title:
      "Classical Form: A Theory of Formal Functions for the Instrumental Music of Haydn, Mozart, and Beethoven",
    publication: "Oxford University Press Inc., 1998.",
  },
  {
    shortForm: "caplin-2013",
    author: "Caplin, William",
    title: "Analyzing Classical Form: An Approach for the Classroom",
    publication: "Oxford University Press Inc., 2013.",
  },
  {
    shortForm: "hutchinson-2017",
    author: "Hutchinson, Robert",
    title: "Music Theory for the 21st-Century Classroom",
    publication: "2017.",
    url: "https://musictheory.pugetsound.edu/mt21c/MusicTheory.html",
  },
  {
    shortForm: "katz-2014",
    author: "Katz, Robert A.",
    title: "Mastering Audio: The Art and the Science",
    publication: "3rd ed. Focal Press, 2014.",
  },
  {
    shortForm: "kostka-2018",
    author: "Kostka, Stefan, et al.",
    title: "Tonal Harmony with an Introduction to Post-Tonal Music",
    publication: "8th ed. McGraw-Hill Education, 2018.",
  },
  {
    shortForm: "lendvai-1971",
    author: "Lendvai, Ernő",
    title: "Béla Bartók: An Analysis of His Music",
    publication: "Humanities Pr., 1971.",
  },
  {
    shortForm: "perricone-2000",
    author: "Perricone, Jack",
    title: "Melody in Songwriting: Tools and Techniques for Writing Hit Songs",
    publication: "Berklee Press, 2000.",
  },
  {
    shortForm: "richards-2016",
    author: "Richards, Mark",
    title: "Film Music Themes: Analysis and Corpus Study",
    publication: "Society for Music Theory, 2016.",
  },
  {
    shortForm: "schoenberg-1999",
    author: "Schoenberg, Arnold",
    title: "Fundamentals of Music Composition",
    publication: "Faber and Faber Limited, 1999.",
    isbn: "978-0571196586",
  },
  {
    shortForm: "thompson-2005",
    author: "Thompson, Daniel M.",
    title:
      "Understanding Audio: Getting the Most Out of Your Project or Professional Recording Studio",
    publication: "Berklee Press, 2005.",
  },
  {
    shortForm: "tjps-2026",
    author: "TJPS",
    title: "The Jazz Piano Site",
    publication: "2026.",
    url: "https://www.thejazzpianosite.com/",
  },
  {
    shortForm: "watkinson-1998",
    author: "Watkinson, Jon",
    title: "The Art of Sound Reproduction",
    publication: "Focal Press, 1998.",
  },
  {
    shortForm: "wyner-2013",
    author: "Wyner, Jonathan",
    title: "Audio Mastering: Essential Practices",
    publication: "Berklee Press, 2013.",
  },
];

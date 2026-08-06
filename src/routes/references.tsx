import { createFileRoute } from "@tanstack/react-router";
import { Flex, Heading, Text } from "@saintly-software/baritone";

/**
 * The bibliography behind the notes. These live in the Obsidian vault's `Sources`
 * folder, which the notes plugin doesn't ingest (it scans only top-level notes),
 * so the curated list is mirrored here. Kept sorted by author surname.
 */
interface Source {
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

const SOURCES: Source[] = [
  {
    author: "Belkin, Alan",
    title: "Music Composition: Craft and Art",
    publication: "Yale University Press, 2018.",
  },
  {
    author: "Caplin, William",
    title:
      "Classical Form: A Theory of Formal Functions for the Instrumental Music of Haydn, Mozart, and Beethoven",
    publication: "Oxford University Press Inc., 1998.",
  },
  {
    author: "Caplin, William",
    title: "Analyzing Classical Form: An Approach for the Classroom",
    publication: "Oxford University Press Inc., 2013.",
  },
  {
    author: "Hutchinson, Robert",
    title: "Music Theory for the 21st-Century Classroom",
    publication: "2017.",
    url: "https://musictheory.pugetsound.edu/mt21c/preface-1.html",
  },
  {
    author: "Katz, Robert A.",
    title: "Mastering Audio: The Art and the Science",
    publication: "3rd ed. Focal Press, 2014.",
  },
  {
    author: "Kostka, Stefan, et al.",
    title: "Tonal Harmony with an Introduction to Post-Tonal Music",
    publication: "8th ed. McGraw-Hill Education, 2018.",
  },
  {
    author: "Lendvai, Ernő",
    title: "Béla Bartók: An Analysis of His Music",
    publication: "Humanities Pr., 1971.",
  },
  {
    author: "Perricone, Jack",
    title: "Melody in Songwriting: Tools and Techniques for Writing Hit Songs",
    publication: "Berklee Press, 2000.",
  },
  {
    author: "Richards, Mark",
    title: "Film Music Themes: Analysis and Corpus Study",
    publication: "Society for Music Theory, 2016.",
  },
  {
    author: "Schoenberg, Arnold",
    title: "Fundamentals of Music Composition",
    publication: "Faber and Faber Limited, 1999.",
    isbn: "978-0571196586",
  },
  {
    author: "Thompson, Daniel M.",
    title:
      "Understanding Audio: Getting the Most Out of Your Project or Professional Recording Studio",
    publication: "Berklee Press, 2005.",
  },
  {
    author: "TJPS",
    title: "The Jazz Piano Site",
    publication: "2026.",
    url: "https://www.thejazzpianosite.com/",
  },
  {
    author: "Watkinson, Jon",
    title: "The Art of Sound Reproduction",
    publication: "Focal Press, 1998.",
  },
  {
    author: "Wyner, Jonathan",
    title: "Audio Mastering: Essential Practices",
    publication: "Berklee Press, 2013.",
  },
];

export const Route = createFileRoute("/references")({
  head: () => ({
    meta: [{ title: "References" }],
  }),
  component: References,
});

function References() {
  return (
    <Flex direction="column" gap="4" style={{ maxWidth: "40rem" }}>
      <Flex direction="column" gap="1">
        <Heading level={1}>References</Heading>
        <Text as="span" size="sm" saliency="low">
          Sources cited throughout these notes.
        </Text>
      </Flex>

      {/* A plain bibliography: author, then the title as a `<cite>` (naturally
          italic), then publication details. Online sources link from the title. */}
      <Flex render={<ul />} direction="column" gap="3" style={{ listStyle: "none" }}>
        {SOURCES.map((source) => (
          <Text key={`${source.author} ${source.title}`} render={<li />}>
            {source.author}.{" "}
            <cite>
              {source.url !== undefined ? (
                // External destination, so a plain anchor rather than a router Link.
                <a href={source.url} target="_blank" rel="noreferrer">
                  {source.title}
                </a>
              ) : (
                source.title
              )}
            </cite>
            . {source.publication}
            {source.isbn !== undefined && (
              <Text as="span" size="sm" saliency="low">
                {" "}
                ISBN {source.isbn}.
              </Text>
            )}
          </Text>
        ))}
      </Flex>
    </Flex>
  );
}

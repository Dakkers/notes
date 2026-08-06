import { Link, createFileRoute } from "@tanstack/react-router";
import { Flex, Heading } from "@saintly-software/baritone";

import { notes } from "virtual:demo-notes";
import { content, footnotes } from "virtual:demo-notes/content";
import { NoteBody } from "../components/NoteBody";
import { NoteInfoPanel } from "../components/NoteInfoPanel";
import proseCss from "../styles/prose.css?url";

// KaTeX's stylesheet for the math the build-time renderer bakes into note bodies
// (see `#/lib/notes/render`). Imported as a module rather than via `?url` so Vite
// rewrites its `url(fonts/…)` references and emits the KaTeX font files as hashed
// assets; a bare `?url` link would leave those font paths dangling.
import "katex/dist/katex.min.css";

export const Route = createFileRoute("/notes/$slug")({
  head: ({ params }) => {
    const note = notes.find((candidate) => candidate.slug === params.slug);
    return {
      meta: [{ title: note?.title ?? "Note not found" }],
      // Prose typography loads only on note pages, not app-wide.
      links: [{ rel: "stylesheet", href: proseCss }],
    };
  },
  component: NotePage,
});

function NotePage() {
  const { slug } = Route.useParams();
  const note = notes.find((candidate) => candidate.slug === slug);
  const tree = content[slug];

  if (note === undefined || tree === undefined) {
    return (
      <Flex direction="column" gap="3">
        <Heading level={1}>Note not found</Heading>
        <Link to="/">← Back home</Link>
      </Flex>
    );
  }

  return (
    // The article and its backlinks panel share a row; `wrap` drops the panel
    // below the note on narrow viewports.
    <Flex gap="6" align="start" wrap>
      {/* `minWidth: 0` lets wide children (code blocks, tables) scroll instead of
          stretching the flex row. */}
      <Flex render={<article />} grow direction="column" gap="4" style={{ minWidth: 0 }}>
        {/* Tags now live in the side panel alongside the note's other metadata. */}
        <Heading level={1}>{note.title}</Heading>

        {/* The body tree is produced at build/dev time by the `demoNotes()` plugin
            (`#/lib/notes/render`); `NoteBody` turns it into React so `[[wikilinks]]`
            navigate through the router. */}
        <NoteBody tree={tree} />
      </Flex>

      <NoteInfoPanel note={note} footnotes={footnotes[slug]} />
    </Flex>
  );
}

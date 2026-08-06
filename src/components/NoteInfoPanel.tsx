import { Fragment, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ChipList, Divider, Flex, Text, vars } from "@saintly-software/baritone";
import type { Root as HastRoot } from "hast";

import type { Note } from "../lib/notes/types";
import { tagIntent, visibleTags } from "../lib/notes/tags";
import { formatWrittenAt } from "../lib/notes/timestamp";
import { renderNoteHast } from "./NoteBody";

const surface = vars.surface.color.neutral.high.default;

/**
 * The right-anchored metadata panel for a note page. It gathers, in one aside,
 * the note's tags, when it was written (from its Zettelkasten id), its footnote
 * references, the notes it links out to, and the notes that link back to it
 * (backlinks — computed at build time in `#/lib/notes/graph`). Each section is
 * omitted when empty; the panel renders nothing when every section is empty.
 */
export function NoteInfoPanel({ note, footnotes }: { note: Note; footnotes?: HastRoot }) {
  const tags = visibleTags(note.tags);
  const writtenAt = formatWrittenAt(note.id);

  const sections: ReactNode[] = [];

  if (tags.length > 0) {
    sections.push(
      <Section key="tags" title="Tags">
        {/* Each chip is a whole-body link (via `render`) to the notes index
            pre-filtered to that tag. A per-chip `render` is used rather than the
            root LinkProvider because the provider only carries a string href, not
            the router's typed `search` object. */}
        <ChipList
          size="sm"
          items={tags.map((tag) => ({
            id: tag,
            children: tag,
            intent: tagIntent(tag),
            render: <Link to="/notes" search={{ tags: [tag] }} />,
          }))}
        />
      </Section>,
    );
  }

  if (writtenAt !== null) {
    sections.push(
      <Section key="written" title="Written">
        <Text as="span" size="sm">
          {writtenAt.date}
          {writtenAt.time !== null && (
            <Text as="span" size="sm" saliency="low">
              {" · "}
              {writtenAt.time}
            </Text>
          )}
        </Text>
      </Section>,
    );
  }

  if (footnotes !== undefined) {
    sections.push(
      <Section key="references" title="References">
        {/* Footnote definitions rendered from the note's hast (`[[wikilink]]`
            citations become router links); styled by `.note-footnotes` in prose.css. */}
        <div className="note-footnotes">{renderNoteHast(footnotes)}</div>
      </Section>,
    );
  }

  if (note.outgoingLinks.length > 0) {
    sections.push(
      <Section key="outgoing" title="Outgoing links">
        <NoteLinkList items={note.outgoingLinks} />
      </Section>,
    );
  }

  if (note.backlinks.length > 0) {
    sections.push(
      <Section key="backlinks" title={note.backlinks.length === 1 ? "Backlink" : "Backlinks"}>
        <NoteLinkList items={note.backlinks} />
      </Section>,
    );
  }

  if (sections.length === 0) return null;

  return (
    <Flex
      render={<aside />}
      direction="column"
      gap="4"
      px="4"
      py="4"
      style={{
        width: "15rem",
        flexShrink: 0,
        alignSelf: "start",
        // Track the reader down long notes rather than scrolling out of view.
        position: "sticky",
        top: vars.space[6],
        backgroundColor: surface.bgc,
        color: surface.text,
        border: `1px solid ${surface.border}`,
        borderRadius: vars.radius.md,
      }}
    >
      {sections.map((section, index) => (
        <Fragment key={index}>
          {/* Hairline rule between sections, never above the first. */}
          {index > 0 && <Divider />}
          {section}
        </Fragment>
      ))}
    </Flex>
  );
}

/** One labelled block: an uppercase caption over its content. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Flex direction="column" gap="2">
      <Text
        as="span"
        size="xs"
        saliency="low"
        style={{ textTransform: "uppercase", letterSpacing: "0.06em" }}
      >
        {title}
      </Text>
      {children}
    </Flex>
  );
}

/** A vertical list of links to other notes — shared by references and backlinks. */
function NoteLinkList({ items }: { items: { slug: string; title: string }[] }) {
  return (
    <Flex direction="column" gap="2">
      {items.map((item) => (
        <Text key={item.slug} as="span" size="sm">
          <Link to="/notes/$slug" params={{ slug: item.slug }}>
            {item.title}
          </Link>
        </Text>
      ))}
    </Flex>
  );
}

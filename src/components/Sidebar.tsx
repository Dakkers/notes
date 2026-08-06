import { Link } from "@tanstack/react-router";
import { Flex, ScrollArea, Text, vars } from "@saintly-software/baritone";
import { notes } from "virtual:demo-notes";

const sortedNotes = [...notes].sort((a, b) =>
  a.title.localeCompare(b.title, undefined, { sensitivity: "base" }),
);

const surface = vars.surface.color.neutral.high.default;

export function Sidebar() {
  return (
    <Flex
      render={<aside />}
      direction="column"
      style={{
        width: "15rem",
        flexShrink: 0,
        alignSelf: "flex-start",
        position: "sticky",
        top: 0,
        height: "100vh",
        backgroundColor: surface.bgc,
        color: surface.text,
        borderRight: `1px solid ${surface.border}`,
      }}
    >
      {/* The note list can outgrow the viewport, so it lives in a ScrollArea that
          fills the sticky aside (min-height:0 lets the flex child actually shrink). */}
      <ScrollArea aria-label="Notes" style={{ flex: 1, minHeight: 0 }}>
        <Flex direction="column" gap="2" px="4" py="6">
          {/* One entry per `.demo` file, linking to its page. `title` is the filename
              minus its Zettelkasten id; `slug` is the `/notes/$slug` route key. */}
          {sortedNotes.map((note) => (
            <Text key={note.fileName} as="span" size="sm">
              <Link to="/notes/$slug" params={{ slug: note.slug }}>
                {note.title}
              </Link>
            </Text>
          ))}
        </Flex>
      </ScrollArea>
    </Flex>
  );
}

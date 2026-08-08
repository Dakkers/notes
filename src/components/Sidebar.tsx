import { Link } from "@tanstack/react-router";
import { Flex, ScrollArea, Text, vars } from "@saintly-software/baritone";
import { notes } from "virtual:demo-notes";
import { byTitle } from "../lib/notes/sort";

// Stub notes (not written yet) stay out of the sidebar; they're still reachable
// via backlinks from the notes that reference them.
const sortedNotes = [...notes].filter((note) => !note.empty).sort(byTitle);

const surface = vars.surface.color.neutral.high.default;
// The current note reads as "selected" via a low-emphasis primary tint —
// distinct from the neutral hover/pressed overlays below.
const selected = vars.surface.color.primary.low.default;

// Interactive-state values consumed by sidebar.css. The theme has no
// hover/pressed tokens, so hover/pressed are neutral overlays built from the
// link's own text colour (theme-agnostic), while "selected" uses primary tokens.
const linkStateVars = {
  "--sidebar-link-px": vars.space[3],
  "--sidebar-link-py": vars.space[2],
  "--sidebar-link-radius": vars.radius.md,
  "--sidebar-link-motion": `${vars.motion.duration.fast} ${vars.motion.easing.standard}`,
  "--sidebar-link-hover-bg": "color-mix(in oklab, currentColor 8%, transparent)",
  "--sidebar-link-active-bg": "color-mix(in oklab, currentColor 14%, transparent)",
  "--sidebar-link-selected-bg": selected.bgc,
  "--sidebar-link-selected-text": selected.text,
  "--sidebar-link-selected-weight": vars.text.weight.semibold,
  "--sidebar-link-focus": vars.surface.focus.primary,
} as React.CSSProperties;

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
        {/* px is 2 (not 4) so a link's full-width hover/selected fill sits just
            inside the aside edge; the link's own padding restores the text inset. */}
        <Flex direction="column" gap="1" px="2" py="6" style={linkStateVars}>
          {/* One entry per `.demo` file, linking to its page. `title` is the filename
              minus its Zettelkasten id; `slug` is the `/notes/$slug` route key. The
              Link *is* the Text element, so the whole padded row is the click target. */}
          {sortedNotes.map((note) => (
            <Text
              key={note.fileName}
              size="sm"
              className="sidebar-link"
              render={<Link to="/notes/$slug" params={{ slug: note.slug }} />}
            >
              {note.title}
            </Text>
          ))}
        </Flex>
      </ScrollArea>
    </Flex>
  );
}

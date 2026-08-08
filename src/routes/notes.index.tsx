import { useMemo } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ChipList, Combobox, Flex, Heading, Text } from "@saintly-software/baritone";
import { z } from "zod";

import { notes } from "virtual:demo-notes";
import { tagIntent, visibleTags } from "../lib/notes/tags";

// Stub notes (not written yet) are omitted from the listing and the tag filter;
// they remain reachable via backlinks from the notes that reference them.
const sortedNotes = [...notes]
  .filter((note) => !note.empty)
  .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));

const tagOptions = [...new Set(sortedNotes.flatMap((note) => visibleTags(note.tags)))]
  .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
  .map((tag) => ({ value: tag, label: `#${tag}` }));

const knownTags = new Set(tagOptions.map((option) => option.value));

const searchSchema = z.object({
  tags: z
    .preprocess(
      (value) => (value == null ? [] : Array.isArray(value) ? value : [value]),
      z.array(z.string()).catch([]),
    )
    .transform((tags) => {
      const filtered = [...new Set(tags.filter((tag) => knownTags.has(tag)))];
      return filtered.length > 0 ? filtered : undefined;
    })
    .optional(),
});

export const Route = createFileRoute("/notes/")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [{ title: "Notes" }],
  }),
  component: NotesIndex,
});

function NotesIndex() {
  const { tags: selectedTags = [] } = Route.useSearch();
  const navigate = Route.useNavigate();

  function setSelectedTags(tags: string[]) {
    navigate({ search: tags.length > 0 ? { tags } : {}, replace: true });
  }

  const visibleNotes = useMemo(() => {
    if (selectedTags.length === 0) return sortedNotes;
    return sortedNotes.filter((note) => selectedTags.some((tag) => note.tags.includes(tag)));
  }, [selectedTags]);

  return (
    <Flex direction="column" gap="4" style={{ maxWidth: "40rem" }}>
      <Flex direction="column" gap="1">
        <Heading level={1}>Notes</Heading>
        <Text as="span" size="sm" saliency="low">
          {visibleNotes.length} of {sortedNotes.length}{" "}
          {sortedNotes.length === 1 ? "note" : "notes"}
        </Text>
      </Flex>

      {tagOptions.length > 0 && (
        <Combobox
          multiple
          label="Filter by tag"
          placeholder="Select one or more tags…"
          options={tagOptions}
          value={selectedTags}
          onValueChange={(tags) => setSelectedTags(tags)}
          helpText="Shows notes matching any selected tag."
        />
      )}

      <Flex render={<ul />} direction="column" gap="3" style={{ listStyle: "none" }}>
        {visibleNotes.map((note) => {
          const shown = visibleTags(note.tags);
          return (
            <Flex key={note.fileName} render={<li />} direction="column" gap="2">
              <Text as="span" size="lg">
                <Link to="/notes/$slug" params={{ slug: note.slug }}>
                  {note.title}
                </Link>
              </Text>

              <Flex align="center" gap="2" wrap>
                {shown.length > 0 && (
                  <ChipList
                    size="sm"
                    saliency="low"
                    items={shown.map((tag) => ({
                      id: tag,
                      children: tag,
                      intent: tagIntent(tag),
                      render: <Link to="/notes" search={{ tags: [tag] }} />,
                    }))}
                  />
                )}
                <Text as="span" size="sm" saliency="low">
                  {note.wordCount} {note.wordCount === 1 ? "word" : "words"}
                </Text>
              </Flex>
            </Flex>
          );
        })}

        {visibleNotes.length === 0 && (
          <Text as="span" size="sm" saliency="low">
            No notes match the selected tags.
          </Text>
        )}
      </Flex>
    </Flex>
  );
}

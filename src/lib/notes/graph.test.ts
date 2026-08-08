import { describe, expect, it } from "vitest";

import { attachBacklinks, attachOutgoingLinks, buildResolver } from "./graph";
import type { Note } from "./types";

function note(over: Partial<Note>): Note {
  return {
    fileName: "n.md",
    name: "n",
    id: null,
    slug: "s",
    title: "t",
    frontmatter: {},
    heading: null,
    links: [],
    backlinks: [],
    outgoingLinks: [],
    tags: [],
    wordCount: 0,
    empty: false,
    ...over,
  };
}

describe("buildResolver", () => {
  const resolve = buildResolver([
    note({
      name: "20220403110000 Harmony definition",
      id: "20220403110000",
      slug: "20220403110000",
    }),
  ]);

  it("resolves by full name, case-insensitively", () => {
    expect(resolve("20220403110000 harmony DEFINITION")).toBe("20220403110000");
  });

  it("resolves by Zettelkasten id", () => {
    expect(resolve("20220403110000")).toBe("20220403110000");
  });

  it("ignores a #heading / #^block suffix", () => {
    expect(resolve("20220403110000 Harmony definition#A heading")).toBe("20220403110000");
  });

  it("returns null for targets not in the vault", () => {
    expect(resolve("belkin-2018")).toBeNull();
  });
});

describe("attachBacklinks", () => {
  it("inverts links: de-dupes per source, skips self + unresolved, sorts by title", () => {
    const a = note({
      name: "A",
      slug: "a",
      title: "Alpha",
      links: [{ target: "A", embed: false }],
    });
    const b = note({
      name: "B",
      slug: "b",
      title: "Bravo",
      links: [
        { target: "a", embed: false }, // resolves to A (case-insensitive)
        { target: "A", embed: true }, // same source→A again: counted once
        { target: "ghost", embed: false }, // unresolved: skipped
      ],
    });
    const c = note({
      name: "C",
      slug: "c",
      title: "Charlie",
      links: [{ target: "A", embed: false }],
    });
    const all = [a, b, c];

    attachBacklinks(all, buildResolver(all));

    // A's self-link is skipped; B and C each contribute one, sorted by title.
    expect(a.backlinks).toEqual([
      { slug: "b", title: "Bravo" },
      { slug: "c", title: "Charlie" },
    ]);
    expect(b.backlinks).toEqual([]);
    expect(c.backlinks).toEqual([]);
  });
});

describe("attachOutgoingLinks", () => {
  it("resolves outgoing links: de-dupes, skips self + unresolved, keeps document order", () => {
    const a = note({
      name: "A",
      slug: "a",
      title: "Alpha",
      links: [
        { target: "C", embed: false }, // resolves to Charlie
        { target: "ghost", embed: false }, // unresolved: skipped
        { target: "b", embed: false }, // resolves to Bravo (case-insensitive)
        { target: "B", embed: true }, // same target again: counted once
        { target: "A", embed: false }, // self-reference: skipped
      ],
    });
    const b = note({ name: "B", slug: "b", title: "Bravo" });
    const c = note({ name: "C", slug: "c", title: "Charlie" });
    const all = [a, b, c];

    attachOutgoingLinks(all, buildResolver(all));

    // Charlie before Bravo — outgoing links follow the order they appear.
    expect(a.outgoingLinks).toEqual([
      { slug: "c", title: "Charlie" },
      { slug: "b", title: "Bravo" },
    ]);
    expect(b.outgoingLinks).toEqual([]);
    expect(c.outgoingLinks).toEqual([]);
  });
});

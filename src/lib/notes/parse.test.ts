import { describe, expect, it } from "vitest";

import { parseNote } from "./parse";

describe("parseNote", () => {
  it("splits the Zettelkasten id from the title", () => {
    const note = parseNote("20220403110000 Harmony definition.md", '# Definition of "harmony"\n');
    expect(note.id).toBe("20220403110000");
    expect(note.name).toBe("20220403110000 Harmony definition");
    expect(note.title).toBe("Harmony definition");
    expect(note.heading).toBe('Definition of "harmony"');
  });

  it("falls back to the bare name when there is no id prefix", () => {
    const note = parseNote("belkin-2018.md", "some body");
    expect(note.id).toBeNull();
    expect(note.title).toBe("belkin-2018");
  });

  it("prefers an explicit frontmatter title over the filename", () => {
    const note = parseNote(
      "20221008090500 Cadence vs cadential progression.md",
      "---\ntitle: '\"Cadence\" vs \"cadential progression\"'\n---\n# Body\n",
    );
    // Slug stays filename-derived; only the display title changes.
    expect(note.slug).toBe("20221008090500");
    expect(note.title).toBe('"Cadence" vs "cadential progression"');
  });

  it("ignores a blank or non-string frontmatter title, falling back to the filename", () => {
    expect(parseNote("20220403110000 Harmony definition.md", "---\ntitle: '   '\n---\n").title).toBe(
      "Harmony definition",
    );
    expect(parseNote("20220403110000 Harmony definition.md", "---\ntitle: 2022\n---\n").title).toBe(
      "Harmony definition",
    );
  });

  it("parses YAML frontmatter and drops it from the body", () => {
    const note = parseNote("x.md", "---\ntags: [Dev]\nstatus: draft\n---\n# Body\ntext here");
    expect(note.frontmatter).toEqual({ tags: ["Dev"], status: "draft" });
    expect(note.heading).toBe("Body");
  });

  it("has an empty frontmatter object when there is none", () => {
    expect(parseNote("x.md", "# Just a body").frontmatter).toEqual({});
  });

  it("collects links, aliases, and embeds", () => {
    const body = [
      "See [[20220403110000 Harmony definition|harmony]].",
      "A [[20220403104100 Phrase|phrase]] ends here.",
      "![[Embed/Caplin Ahead!]]",
      "cite [[caplin-2013]] p.20",
    ].join("\n\n");
    const note = parseNote("x.md", body);

    expect(note.links).toEqual([
      { target: "20220403110000 Harmony definition", alias: "harmony", embed: false },
      { target: "20220403104100 Phrase", alias: "phrase", embed: false },
      { target: "Embed/Caplin Ahead!", embed: true },
      { target: "caplin-2013", embed: false },
    ]);
  });

  it("ignores tags and links that sit inside code", () => {
    const note = parseNote(
      "x.md",
      "text `#notatag` and `[[notalink]]` here\n\n```\n#alsonot [[nope]]\n```",
    );
    expect(note.tags).toEqual([]);
    expect(note.links).toEqual([]);
  });

  it("captures emoji tags, de-dupes, and merges frontmatter tags", () => {
    const note = parseNote("x.md", "---\ntags: [Dev, 🔗]\n---\n# H\n\n#🔗 counterpoint\n\n#🎼");
    expect(note.tags).toEqual(["🔗", "🎼", "Dev"]);
  });

  it("counts prose words, excluding code blocks", () => {
    const note = parseNote("x.md", "one two three\n\n```\nignored code words here\n```");
    expect(note.wordCount).toBe(3);
  });

  it("flags a blank body (frontmatter aside) as an empty stub", () => {
    expect(parseNote("x.md", "").empty).toBe(true);
    expect(parseNote("x.md", "   \n\n").empty).toBe(true);
    expect(parseNote("x.md", "---\ntags: [Dev]\n---\n").empty).toBe(true);
    expect(parseNote("x.md", "# Just a heading").empty).toBe(false);
    expect(parseNote("x.md", "some body").empty).toBe(false);
  });
});

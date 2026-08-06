import type { Element, Root } from "hast";
import { visit } from "unist-util-visit";
import { describe, expect, it } from "vitest";

import type { AttachmentIndex } from "./attachments";
import { createNoteRenderer } from "./render";

// A resolver that knows one source note, so `[[kostka-2018]]` inside a footnote
// becomes a real link and anything else stays unresolved.
const render = createNoteRenderer((target) => (target === "kostka-2018" ? "kostka-2018" : null));

// A stub attachment index that knows one image, `diagram.png`, mirroring how the
// real index matches by basename (case-insensitively, ignoring any folder).
const imageIndex: AttachmentIndex = {
  resolve(reference) {
    const key = (reference.trim().split(/[\\/]/).pop() ?? "").toLowerCase();
    return key === "diagram.png"
      ? { absPath: "/vault/Diagram.png", ext: ".png", url: "/attachments/deadbeef0000.png" }
      : null;
  },
  used: () => [],
  all: () => [],
};

// Renderer that also knows notes named `some-note` (so a `![[some-note]]` embed is a
// transclusion, not an image) alongside the image index above.
const renderWithImages = createNoteRenderer(
  (target) => (target === "some-note" ? "some-note" : null),
  imageIndex,
);

function tagNames(tree: Root): Set<string> {
  const names = new Set<string>();
  visit(tree, "element", (node) => void names.add(node.tagName));
  return names;
}

function hrefs(tree: Root): string[] {
  const out: string[] = [];
  visit(tree, "element", (node) => {
    const href = node.properties?.href;
    if (node.tagName === "a" && typeof href === "string") out.push(href);
  });
  return out;
}

function images(tree: Root): Element[] {
  const out: Element[] = [];
  visit(tree, "element", (node) => void (node.tagName === "img" && out.push(node)));
  return out;
}

describe("createNoteRenderer footnotes", () => {
  it("splits footnotes out of the body into their own <ol> tree", () => {
    const { body, footnotes } = render("A claim.[^1]\n\n[^1]: [[kostka-2018]] p.147\n", "Title");

    if (footnotes === null) throw new Error("expected footnotes to be extracted");
    // The footnotes tree is just the list of definitions…
    expect(tagNames(footnotes).has("ol")).toBe(true);
    // …with the resolved citation as a router-navigable link.
    expect(hrefs(footnotes)).toContain("/notes/kostka-2018");

    // The body keeps the inline `[^1]` marker (a <sup>) but no longer carries the
    // auto-generated footnotes <section>.
    expect(tagNames(body).has("sup")).toBe(true);
    let hasSection = false;
    visit(body, "element", (node) => {
      if (node.tagName === "section" && node.properties?.dataFootnotes !== undefined) {
        hasSection = true;
      }
    });
    expect(hasSection).toBe(false);
  });

  it("returns null footnotes for a note that has none", () => {
    const { footnotes } = render("Just prose, no citations here.\n", "Title");
    expect(footnotes).toBeNull();
  });
});

function hasKatex(tree: Root): boolean {
  let found = false;
  visit(tree, "element", (node) => {
    if (Array.isArray(node.properties?.className) && node.properties.className.includes("katex")) {
      found = true;
    }
  });
  return found;
}

describe("createNoteRenderer math", () => {
  it("renders inline `$…$` math to KaTeX markup", () => {
    const { body } = render("The chain is $I - V$ here.\n", "Title");
    expect(hasKatex(body)).toBe(true);
    // The KaTeX span carries the rendered variable, not the raw `$` delimiters.
    let text = "";
    visit(body, "text", (node) => void (text += node.value));
    expect(text).not.toContain("$");
  });

  it("renders display `$$…$$` math as a block", () => {
    const { body } = render("$$\n\\frac{a}{b}\n$$\n", "Title");
    let display = false;
    visit(body, "element", (node) => {
      if (
        Array.isArray(node.properties?.className) &&
        node.properties.className.includes("katex-display")
      ) {
        display = true;
      }
    });
    expect(display).toBe(true);
  });

  it("leaves `$`-delimited math out of `[[wikilink]]` handling", () => {
    // A `$…$` span that happens to contain brackets must not be parsed as a wikilink.
    const { body } = render("Set $[a, b]$ notation.\n", "Title");
    expect(hasKatex(body)).toBe(true);
    expect(hrefs(body)).toHaveLength(0);
  });
});

describe("createNoteRenderer images", () => {
  it("renders an `![[image.png]]` embed as an <img> pointing at the served asset", () => {
    const { body } = renderWithImages("Here: ![[Diagram.png]]\n", "Title");
    const [img, ...rest] = images(body);
    expect(rest).toHaveLength(0);
    expect(img.properties?.src).toBe("/attachments/deadbeef0000.png");
    // Alt text falls back to the filename stem for accessibility.
    expect(img.properties?.alt).toBe("Diagram");
  });

  it("applies the `|width` and `|widthxheight` size hints on embeds", () => {
    const width = images(renderWithImages("![[Diagram.png|300]]\n", "T").body)[0];
    expect(width.properties?.width).toBe(300);
    expect(width.properties?.height).toBeUndefined();

    const both = images(renderWithImages("![[Diagram.png|300x200]]\n", "T").body)[0];
    expect(both.properties?.width).toBe(300);
    expect(both.properties?.height).toBe(200);
  });

  it("rewrites a relative markdown image source to the served asset, keeping alt", () => {
    const { body } = renderWithImages("![A diagram](_Meta/Files/diagram.png)\n", "Title");
    const [img] = images(body);
    expect(img.properties?.src).toBe("/attachments/deadbeef0000.png");
    expect(img.properties?.alt).toBe("A diagram");
  });

  it("leaves external and unmatched image sources untouched", () => {
    const external = images(render("![x](https://example.com/a.png)\n", "T").body)[0];
    expect(external.properties?.src).toBe("https://example.com/a.png");

    const missing = images(renderWithImages("![x](nope.png)\n", "T").body)[0];
    expect(missing.properties?.src).toBe("nope.png");
  });

  it("still treats a non-image `![[note]]` embed as a note transclusion, not an image", () => {
    const { body } = renderWithImages("![[some-note]]\n", "Title");
    expect(images(body)).toHaveLength(0);
    expect(hrefs(body)).toContain("/notes/some-note");
  });

  it("marks an unresolved `![[missing.png]]` embed as unresolved rather than an <img>", () => {
    const { body } = renderWithImages("![[missing.png]]\n", "Title");
    expect(images(body)).toHaveLength(0);
    let unresolved = false;
    visit(body, "element", (node) => {
      if (
        node.tagName === "span" &&
        Array.isArray(node.properties?.className) &&
        node.properties.className.includes("is-unresolved")
      ) {
        unresolved = true;
      }
    });
    expect(unresolved).toBe(true);
  });
});

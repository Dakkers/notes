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

// Renderer that also knows a note named `some-note` (so a `![[some-note]]` embed is a
// note reference, not an image) alongside the image index above. No note bodies are
// supplied, so embeds fall back to links rather than transcluding.
const renderWithImages = createNoteRenderer(
  (target) => (target === "some-note" ? "some-note" : null),
  imageIndex,
);

function tagNames(tree: Root | Element): Set<string> {
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

function textContent(tree: Root): string {
  let out = "";
  visit(tree, "text", (node) => void (out += node.value));
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

describe("createNoteRenderer source citations", () => {
  it("links a `[[Sources/<id>]]` citation to its row on the References page", () => {
    // `Sources/…` isn't a note (the resolver here doesn't know it), so this must be
    // routed to the References anchor by the `Sources/` rule, not left unresolved.
    const { body } = render("See [[Sources/caplin-1998|Caplin]] on cadences.\n", "Title");
    expect(hrefs(body)).toContain("/references#caplin-1998");
    expect(textContent(body)).toContain("Caplin");
  });

  it("shows the short form (not the `Sources/` path) when the citation has no alias", () => {
    const { body } = render("Per [[Sources/kostka-2018]].\n", "Title");
    expect(hrefs(body)).toContain("/references#kostka-2018");
    expect(textContent(body)).toContain("kostka-2018");
    expect(textContent(body)).not.toContain("Sources/");
  });

  it("still resolves a bare `[[kostka-2018]]` to the note, not the References page", () => {
    // Only the `Sources/` prefix diverts to the bibliography; a plain id is a note link.
    const { body } = render("Per [[kostka-2018]].\n", "Title");
    expect(hrefs(body)).toContain("/notes/kostka-2018");
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

  it("treats a non-image `![[note]]` embed as a note reference, not an image", () => {
    // With no body available for `some-note`, the embed stays a link (see the
    // transclusion suite below for when a body *is* supplied).
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

// A vault whose note bodies are available to transclude. Slugs are the note names
// here, so the resolver is the identity for known notes.
const embedSources = new Map([
  ["target", { raw: "# Target\n\nEmbedded **body**, citing [[kostka-2018]].\n", title: "Target" }],
  ["host", { raw: "Intro.\n\n![[target]]\n\nOutro.\n", title: "Host" }],
  ["loop-a", { raw: "Body A.\n\n![[loop-b]]\n", title: "Loop A" }],
  ["loop-b", { raw: "Body B.\n\n![[loop-a]]\n", title: "Loop B" }],
]);
const renderEmbeds = createNoteRenderer(
  (target) => (embedSources.has(target) || target === "kostka-2018" ? target : null),
  undefined,
  embedSources,
);

function withClass(tree: Root | Element, cls: string): Element[] {
  const out: Element[] = [];
  visit(tree, "element", (node) => {
    const className = node.properties?.className;
    if (Array.isArray(className) && className.includes(cls)) out.push(node);
  });
  return out;
}

function textOf(tree: Root | Element): string {
  let out = "";
  visit(tree, "text", (node) => void (out += node.value));
  return out;
}

describe("createNoteRenderer transclusion", () => {
  it("transcludes a standalone `![[note]]` into a `.embed` card with the target's body", () => {
    const { body } = renderEmbeds(embedSources.get("host")!.raw, "Host", "host");

    const [embed, ...rest] = withClass(body, "embed");
    expect(rest).toHaveLength(0);

    const [content] = withClass(body, "embed-content");
    expect(textOf(content)).toContain("Embedded body");
    // The embedded body's own bold/inline markup renders inside the card…
    expect(tagNames(content).has("strong")).toBe(true);
    // …and its heading is demoted (never an <h1>, so it can't rival the host title).
    expect(tagNames(content).has("h1")).toBe(false);

    // A link back to the source note sits inside the card, labelled with its title.
    const back = withClass(embed, "embed-link");
    expect(back).toHaveLength(1);
    expect(back[0].properties?.href).toBe("/notes/target");
    expect(textOf(back[0])).toContain("Target");
  });

  it("keeps resolving `[[wikilinks]]` inside a transcluded body", () => {
    const { body } = renderEmbeds(embedSources.get("host")!.raw, "Host", "host");
    expect(hrefs(body)).toContain("/notes/kostka-2018");
  });

  it("leaves an inline (non-standalone) `![[note]]` as a link, not a card", () => {
    const { body } = renderEmbeds("See ![[target]] for more.\n", "Host", "host");
    expect(withClass(body, "embed-content")).toHaveLength(0);
    expect(hrefs(body)).toContain("/notes/target");
  });

  it("falls back to a link when no body is available for the target", () => {
    // `kostka-2018` resolves but has no entry in `embedSources`.
    const { body } = renderEmbeds("![[kostka-2018]]\n", "Host", "host");
    expect(withClass(body, "embed-content")).toHaveLength(0);
    expect(hrefs(body)).toContain("/notes/kostka-2018");
  });

  it("breaks embed cycles instead of recursing forever", () => {
    // loop-a → loop-b → loop-a: the second hop back to loop-a is left as a link.
    const { body } = renderEmbeds(embedSources.get("loop-a")!.raw, "Loop A", "loop-a");
    expect(textOf(body)).toContain("Body B");
    // The cycle's return edge to loop-a survives as a link rather than a fifth card.
    expect(hrefs(body)).toContain("/notes/loop-a");
  });
});

describe("createNoteRenderer callouts", () => {
  it("renders a foldable `[!type]-` callout as a collapsed <details> card", () => {
    const { body } = render("> [!warning]- Heads up\n> Be careful here.\n", "Title");

    const [callout] = withClass(body, "callout");
    expect(callout.tagName).toBe("details");
    // `-` starts collapsed → no `open` attribute.
    expect(callout.properties?.open).toBeUndefined();
    expect(callout.properties?.className).toContain("callout-warning");

    const [title] = withClass(body, "callout-title");
    expect(title.tagName).toBe("summary");
    expect(textOf(title)).toBe("Heads up");

    const [content] = withClass(body, "callout-content");
    expect(textOf(content)).toContain("Be careful here.");
  });

  it("starts a `[!type]+` callout expanded", () => {
    const { body } = render("> [!note]+ Open me\n> Body.\n", "Title");
    const [callout] = withClass(body, "callout");
    expect(callout.tagName).toBe("details");
    expect(callout.properties?.open).toBe(true);
  });

  it("renders a non-foldable callout as a <div>, defaulting the title to the type", () => {
    const { body } = render("> [!tip]\n> Handy.\n", "Title");
    const [callout] = withClass(body, "callout");
    expect(callout.tagName).toBe("div");

    const [title] = withClass(body, "callout-title");
    expect(title.tagName).toBe("div");
    // No title text after the marker → capitalised type.
    expect(textOf(title)).toBe("Tip");
  });

  it("resolves `[[wikilinks]]` inside a callout body", () => {
    const { body } = render("> [!info] See\n> Refer to [[kostka-2018]].\n", "Title");
    expect(hrefs(body)).toContain("/notes/kostka-2018");
  });

  it("leaves a plain blockquote (no marker) untouched", () => {
    const { body } = render("> Just a quote.\n", "Title");
    expect(withClass(body, "callout")).toHaveLength(0);
    expect(tagNames(body).has("blockquote")).toBe(true);
  });
});

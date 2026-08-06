import matter from "gray-matter";
import type { Element, Root as HastRoot } from "hast";
import type { Heading, Nodes, Root, RootContent } from "mdast";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { SKIP, visit } from "unist-util-visit";
import { VFile } from "vfile";

import { type AttachmentIndex, emptyAttachmentIndex } from "./attachments";
import type { ResolveTarget } from "./graph";

const LINK_RE = /(!?)\[\[([^\]]+)\]\]/g;
// The `|size` segment of an image embed: `width` or `widthxheight`, e.g. `![[x.png|300]]`.
const IMAGE_SIZE_RE = /^(\d+)(?:x(\d+))?$/;
// A URL that already names its own scheme/host/root — `http:`, `//cdn`, `/foo`,
// `data:` — so it must be left as-is rather than resolved against the vault.
const ABSOLUTE_URL_RE = /^([a-z][a-z0-9+.-]*:|\/\/|\/)/i;

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!,
  );
}

function textOf(node: Nodes): string {
  let out = "";
  visit(node, (child) => {
    if (child.type === "text" || child.type === "inlineCode") out += child.value;
  });
  return out;
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** A reference's filename minus directory and extension, e.g. `"a/b.png"` → `"b"`. */
function fileStem(reference: string): string {
  const base = reference.trim().split(/[\\/]/).pop() ?? reference;
  return base.replace(/\.[^.]+$/, "");
}

/**
 * Build the mdast node a single `[[wikilink]]` / `![[embed]]` becomes. `pipe` is
 * the raw text after the `|`, if any — a display alias for a note link, or a
 * display size (`300`, `300x200`) for an image embed.
 */
function linkNode(
  target: string,
  pipe: string | undefined,
  embed: boolean,
  resolve: ResolveTarget,
  attachments: AttachmentIndex,
): RootContent {
  // `![[image.png]]` / `![[image.png|width]]` / `![[image.png|widthxheight]]` — an
  // image embed. Only `![[...]]` (not `[[...]]`) can embed, and the file must be in
  // the vault's attachments; anything else falls through to note-link handling.
  if (embed) {
    const att = attachments.resolve(target);
    if (att !== null) {
      const hProperties: Record<string, number> = {};
      const size = pipe === undefined ? null : IMAGE_SIZE_RE.exec(pipe);
      if (size !== null) {
        hProperties.width = Number(size[1]);
        if (size[2] !== undefined) hProperties.height = Number(size[2]);
      }
      return { type: "image", url: att.url, alt: fileStem(target), data: { hProperties } };
    }
  }

  const label = (pipe ?? target).trim();
  const kind = embed ? "embed" : "wikilink";
  // A wikilink target may carry a `#heading` / `#^block` suffix; resolve the note part only.
  const slug = resolve(target.split(/[#^]/, 1)[0].trim());

  if (slug === null) {
    // Unlinked reference to a note that doesn't exist (yet) — styled, not clickable.
    return {
      type: "html",
      value: `<span class="${kind} is-unresolved">${escapeHtml(label)}</span>`,
    };
  }
  return {
    type: "link",
    url: `/notes/${encodeURIComponent(slug)}`,
    data: { hProperties: { className: [kind] } },
    children: [{ type: "text", value: label }],
  };
}

/**
 * Remark transform for the two Obsidian syntaxes CommonMark doesn't cover. It
 * only rewrites `text` nodes, so `[[…]]` sitting inside `code`/`inlineCode` is
 * left verbatim (remark parks those in separate nodes).
 */
function remarkObsidianLinks(resolve: ResolveTarget, attachments: AttachmentIndex) {
  return (tree: Root) => {
    visit(tree, "text", (node, index, parent) => {
      if (parent === undefined || index === undefined || !node.value.includes("[[")) return;

      const replacement: RootContent[] = [];
      let last = 0;
      for (const match of node.value.matchAll(LINK_RE)) {
        const start = match.index;
        if (start > last) replacement.push({ type: "text", value: node.value.slice(last, start) });

        const [targetRaw, pipeRaw] = match[2].split("|");
        replacement.push(
          linkNode(targetRaw.trim(), pipeRaw?.trim(), match[1] === "!", resolve, attachments),
        );
        last = start + match[0].length;
      }
      if (last < node.value.length)
        replacement.push({ type: "text", value: node.value.slice(last) });

      parent.children.splice(index, 1, ...replacement);
      return [SKIP, index + replacement.length];
    });
  };
}

/**
 * Rewrite relative markdown-image sources (`![alt](image.png)`) to the served
 * attachment URL, resolving them against the vault by basename the way Obsidian
 * does. Absolute URLs — `http(s)://`, protocol-relative, root-absolute, `data:` —
 * are left untouched, as are the `/attachments/...` URLs the `![[embed]]` pass
 * above already produced. A source with no matching vault file is left as-is.
 */
function remarkAttachmentImages(attachments: AttachmentIndex) {
  return (tree: Root) => {
    visit(tree, "image", (node) => {
      if (ABSOLUTE_URL_RE.test(node.url)) return;
      let reference: string;
      try {
        reference = decodeURIComponent(node.url);
      } catch {
        reference = node.url;
      }
      const att = attachments.resolve(reference);
      if (att !== null) node.url = att.url;
    });
  };
}

/**
 * Headings pass, keyed to the note's title (carried on the VFile):
 *  1. Drop a leading heading that only restates the title — the page already
 *     renders the title as its `<h1>`, so this avoids saying it twice.
 *  2. Demote the remaining headings one level, keeping that title the sole `<h1>`
 *     and the body's outline starting at `<h2>`.
 */
function remarkHeadings() {
  return (tree: Root, file: VFile) => {
    const title = typeof file.data.title === "string" ? file.data.title : "";
    const first = tree.children[0];
    if (
      first?.type === "heading" &&
      title !== "" &&
      normalize(textOf(first)) === normalize(title)
    ) {
      tree.children.shift();
    }
    visit(tree, "heading", (node) => {
      node.depth = Math.min(6, node.depth + 1) as Heading["depth"];
    });
  };
}

/** A note's rendered body, with its footnotes split out for separate placement. */
export interface RenderedNote {
  /** The body hast tree, with the auto-generated footnotes section removed. */
  body: HastRoot;
  /**
   * The footnotes as a hast tree (a single `<ol>` of definitions), or null when
   * the note has none. The note page renders these in the side panel rather than
   * at the foot of the article. In-body `[^n]` markers still anchor to them,
   * since both live on the same page.
   */
  footnotes: HastRoot | null;
}

/**
 * `remark-gfm` appends footnote definitions as a `<section data-footnotes>` at the
 * end of the tree. Detach it (mutating `tree`) and return just its `<ol>` — the
 * `sr-only` label and section wrapper are dropped, since the panel supplies its
 * own heading.
 */
function detachFootnotes(tree: HastRoot): HastRoot | null {
  const index = tree.children.findIndex(
    (node): node is Element =>
      node.type === "element" &&
      node.tagName === "section" &&
      (node.properties?.dataFootnotes !== undefined ||
        (Array.isArray(node.properties?.className) &&
          node.properties.className.includes("footnotes"))),
  );
  if (index === -1) return null;

  const [section] = tree.children.splice(index, 1);
  const list = (section as Element).children.find(
    (child): child is Element => child.type === "element" && child.tagName === "ol",
  );
  return list === undefined ? null : { type: "root", children: [list] };
}

/**
 * Build a renderer that turns a note's raw markdown into **hast trees** (HTML
 * AST) rather than HTML strings — the app converts them to React so internal
 * `[[wikilinks]]` can render as real router links (see `#/components/NoteBody`).
 * The body and footnotes come back separately so the page can place footnotes in
 * the side panel; see {@link RenderedNote}.
 *
 * Runs entirely at build/dev time (in the Vite plugin), so no markdown machinery
 * ships to the client. `allowDangerousHtml` + `rehype-raw` keep inline HTML the
 * notes already use (e.g. `<sup>`); the content is local and trusted. `resolve`
 * maps wikilink targets to route slugs; `attachments` maps image references to
 * served asset URLs (see `#/lib/notes/attachments`); `title` is the page heading,
 * passed through so {@link remarkHeadings} can de-duplicate it.
 */
export function createNoteRenderer(
  resolve: ResolveTarget,
  attachments: AttachmentIndex = emptyAttachmentIndex(),
): (raw: string, title: string) => RenderedNote {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkObsidianLinks, resolve, attachments)
    .use(remarkAttachmentImages, attachments)
    .use(remarkHeadings)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw);

  return (raw, title) => {
    const file = new VFile({ value: matter(raw).content, data: { title } });
    const body = processor.runSync(processor.parse(file), file);
    return { body, footnotes: detachFootnotes(body) };
  };
}

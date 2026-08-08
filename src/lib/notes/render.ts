import matter from "gray-matter";
import type { Element, Root as HastRoot } from "hast";
import type { Heading, Nodes, Paragraph, Root, RootContent } from "mdast";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { SKIP, visit } from "unist-util-visit";
import { VFile } from "vfile";

import { type AttachmentIndex, emptyAttachmentIndex } from "./attachments";
import type { ResolveTarget } from "./graph";

const LINK_RE = /(!?)\[\[([^\]]+)\]\]/g;
// How deeply `![[note]]` transclusions may nest before we stop expanding and fall
// back to a plain link — a backstop against runaway (but acyclic) embed chains.
const MAX_EMBED_DEPTH = 3;
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

// A wikilink into the vault's `Sources/` folder — a bibliography citation. That
// folder isn't ingested as notes (it's mirrored on the References page instead,
// see `#/lib/references`), so these resolve to a page anchor rather than a note.
const SOURCE_LINK_RE = /^sources[\\/]+(.+)$/i;

/**
 * The short form of a `[[Sources/<short-form>]]` citation (dropping any
 * `#heading`/`#^block` suffix), or null if the target isn't a `Sources/` link.
 * The short form is the `Sources/…` filename, which is also the id of the matching
 * row on the References page — so the citation links to `/references#<short-form>`.
 */
function sourceShortForm(target: string): string | null {
  const path = target.split(/[#^]/, 1)[0].trim();
  const match = SOURCE_LINK_RE.exec(path);
  return match === null ? null : match[1].trim();
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

  // A `[[Sources/…]]` citation points at the bibliography on the References page,
  // not at a note. (Embeds don't transclude sources, so only plain links qualify.)
  const source = embed ? null : sourceShortForm(target);
  if (source !== null) {
    return {
      type: "link",
      url: `/references#${encodeURIComponent(source)}`,
      data: { hProperties: { className: ["wikilink", "reference-link"] } },
      children: [{ type: "text", value: (pipe ?? source).trim() }],
    };
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

// An Obsidian callout marker opening a blockquote's first line: `[!type]`, an
// optional fold sign (`+` = collapsible+open, `-` = collapsible+collapsed), then
// an optional title. e.g. `> [!warning]- Heads up`.
const CALLOUT_RE = /^\[!([\w-]+)\]([+-]?)[ \t]*(.*)$/;

/** `"info"` → `"Info"` — the fallback callout title when the marker gives none. */
function titleCase(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

/**
 * Expand Obsidian callouts — a blockquote whose first line is `[!type]` — into a
 * styled card. The optional fold sign makes it collapsible: `+` open, `-` closed;
 * those become a native `<details>`/`<summary>` (so collapsing needs no client
 * JS), while a non-foldable callout is a plain `<div>`. The rest of the first line
 * is the title (defaulting to the capitalised type); everything after is the body.
 *
 * Runs before {@link remarkObsidianLinks}/{@link remarkMath}'s effect matters:
 * those visit `text` nodes wherever they sit, so `[[wikilinks]]` and `$math$`
 * inside a callout's title or body still resolve. A blockquote without the marker
 * is left untouched (a normal quote).
 */
function remarkCallouts() {
  return (tree: Root) => {
    visit(tree, "blockquote", (node, index, parent) => {
      if (parent === undefined || index === undefined) return;
      const head = node.children[0];
      if (head?.type !== "paragraph") return;
      const lead = head.children[0];
      if (lead?.type !== "text") return;

      // Match the marker against the first line only; a soft line break inside the
      // leading text node means the title ends there and the rest is body.
      const newlineAt = lead.value.indexOf("\n");
      const firstLine = newlineAt === -1 ? lead.value : lead.value.slice(0, newlineAt);
      const match = CALLOUT_RE.exec(firstLine);
      if (match === null) return;

      const [, typeRaw, fold, titleText] = match;
      const type = typeRaw.toLowerCase();
      const foldable = fold !== "";
      const expanded = fold !== "-";
      // Length of the `[!type]<fold>` marker + trailing space that precede the title.
      const markerLen = firstLine.length - titleText.length;

      // Walk the first paragraph's inline children, stripping the marker and
      // splitting title from any body text that follows a soft line break.
      const titleInline: RootContent[] = [];
      const leadBody: RootContent[] = [];
      let inBody = false;
      head.children.forEach((child, i) => {
        let c = child;
        if (i === 0 && c.type === "text") c = { ...c, value: c.value.slice(markerLen) };
        if (inBody) {
          leadBody.push(c);
          return;
        }
        if (c.type === "text") {
          const nl = c.value.indexOf("\n");
          if (nl === -1) {
            titleInline.push(c);
          } else {
            const before = c.value.slice(0, nl);
            const after = c.value.slice(nl + 1);
            if (before !== "") titleInline.push({ type: "text", value: before });
            if (after !== "") leadBody.push({ type: "text", value: after });
            inBody = true;
          }
        } else {
          titleInline.push(c);
        }
      });

      const isBlank = (n: RootContent) => n.type === "text" && n.value.trim() === "";
      const hasTitle = titleInline.some((n) => !isBlank(n));
      const titleChildren: RootContent[] = hasTitle
        ? titleInline
        : [{ type: "text", value: titleCase(type) }];

      // Body: any inline remainder from the first line becomes a leading paragraph,
      // then the blockquote's remaining blocks.
      const leadBodyKept = leadBody.filter((n) => !isBlank(n));
      const bodyChildren: RootContent[] = [];
      if (leadBodyKept.length > 0)
        bodyChildren.push({ type: "paragraph", children: leadBodyKept } as RootContent);
      bodyChildren.push(...node.children.slice(1));

      const hProperties: Record<string, unknown> = { className: ["callout", `callout-${type}`] };
      // `<details open>` starts expanded; a collapsed one omits `open`.
      if (foldable && expanded) hProperties.open = true;

      // Custom node types fall through to the generic mdast→hast element path,
      // which honours `hName`/`hProperties` and recurses into `children` (same
      // mechanism as {@link embedContainer}).
      const callout = {
        type: "callout",
        data: { hName: foldable ? "details" : "div", hProperties },
        children: [
          {
            type: "calloutTitle",
            data: {
              hName: foldable ? "summary" : "div",
              hProperties: { className: ["callout-title"] },
            },
            children: titleChildren,
          },
          {
            type: "calloutBody",
            data: { hName: "div", hProperties: { className: ["callout-content"] } },
            children: bodyChildren,
          },
        ],
      } as unknown as RootContent;

      parent.children[index] = callout;
      return [SKIP, index];
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

/**
 * The raw markdown + title of a note, keyed by slug — what a `![[note]]` embed
 * pulls in. `routable` is whether the source note has its own `/notes/<slug>`
 * page; when `false` (a transclusion-only source, e.g. a `_Meta/Embed` snippet)
 * the transcluded card omits its back-link, since there's nothing to link to.
 * Absent → treated as routable.
 */
export type NoteSources = ReadonlyMap<string, { raw: string; title: string; routable?: boolean }>;

/** Turn an mdast subtree into the note's mdast body children, for transclusion. */
type RenderInner = (raw: string, title: string, stack: string[]) => RootContent[];

/**
 * When a paragraph is nothing but a single resolved note embed (`![[note]]` on its
 * own line, rendered by {@link remarkObsidianLinks} to a `.embed` link), return that
 * link; otherwise null. Surrounding whitespace-only text is ignored, so the embed
 * doesn't have to be the literal sole child. Inline embeds mixed with other prose
 * stay as links — only a standalone embed becomes a transclusion.
 */
function loneEmbedLink(node: Paragraph): Extract<RootContent, { type: "link" }> | null {
  const kids = node.children.filter(
    (child) => !(child.type === "text" && child.value.trim() === ""),
  );
  if (kids.length !== 1) return null;
  const only = kids[0];
  if (only.type !== "link") return null;
  const className = only.data?.hProperties?.className;
  if (!Array.isArray(className) || !className.includes("embed")) return null;
  return only;
}

/** The note slug an `.embed` link points at, decoded from its `/notes/<slug>` url. */
function embedSlug(link: Extract<RootContent, { type: "link" }>): string {
  return decodeURIComponent(link.url.replace(/^\/notes\//, ""));
}

/** Strip footnote references/definitions from an embedded note so its citations don't
 * bleed into the host note's single footnotes section. */
function stripFootnotes(tree: Root): void {
  visit(tree, (node, index, parent) => {
    if (
      parent !== null &&
      parent !== undefined &&
      index !== undefined &&
      (node.type === "footnoteReference" || node.type === "footnoteDefinition")
    ) {
      parent.children.splice(index, 1);
      return [SKIP, index];
    }
  });
}

/**
 * The mdast node a transcluded note becomes: a `.embed` card wrapping the embedded
 * body, with a link back to the source note underneath (Obsidian shows the same
 * affordance) — omitted when the source has no page of its own (`routable` false).
 * Built with `hName`/`hProperties` so it converts to plain `<div>`s.
 */
function embedContainer(
  children: RootContent[],
  url: string,
  title: string,
  routable: boolean,
): RootContent {
  const content: RootContent = {
    type: "embedContent",
    data: { hName: "div", hProperties: { className: ["embed-content"] } },
    children,
  } as unknown as RootContent;
  // A transclusion-only source (e.g. a `_Meta/Embed` snippet) has no route, so
  // there's nothing to link back to — render just the content.
  const backLink: RootContent = {
    type: "link",
    url,
    data: { hProperties: { className: ["embed-link"] } },
    children: [{ type: "text", value: title }],
  };
  // Custom node types (no mdast→hast handler) fall through to the generic element
  // path, which honours `data.hName`/`hProperties` and recurses into `children`.
  return {
    type: "embedContainer",
    data: { hName: "div", hProperties: { className: ["embed"] } },
    children: routable ? [content, backLink] : [content],
  } as unknown as RootContent;
}

/**
 * Expand standalone `![[note]]` embeds into inline transclusions of the target
 * note's body. Runs *after* {@link remarkObsidianLinks} (which has already turned
 * the embed into a `.embed` link) and last in the remark pipeline, so the spliced-in
 * body — itself produced by a full recursive render — isn't reprocessed here.
 *
 * `sources` supplies the target's raw markdown; a target with no source (e.g. the
 * unit tests' bare resolver) is left as the link. `file.data.embedStack` carries the
 * slugs currently being rendered, so a cycle or an over-deep chain falls back to the
 * link rather than looping.
 */
function remarkNoteEmbeds(sources: NoteSources, renderInner: RenderInner) {
  return (tree: Root, file: VFile) => {
    const stack = Array.isArray(file.data.embedStack) ? (file.data.embedStack as string[]) : [];
    visit(tree, "paragraph", (node, index, parent) => {
      if (parent === undefined || index === undefined) return;
      const link = loneEmbedLink(node);
      if (link === null) return;

      const slug = embedSlug(link);
      const source = sources.get(slug);
      // No body available, a self/ancestor cycle, or too deep → keep the plain link.
      if (source === undefined || stack.includes(slug) || stack.length >= MAX_EMBED_DEPTH) return;

      const children = renderInner(source.raw, source.title, [...stack, slug]);
      parent.children[index] = embedContainer(
        children,
        link.url,
        source.title,
        source.routable !== false,
      );
      return [SKIP, index + 1];
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
  sources: NoteSources = new Map(),
): (raw: string, title: string, slug?: string) => RenderedNote {
  // Markdown → resolved mdast (Obsidian syntax expanded). Reused recursively for
  // embeds, so it stops at mdast; `remarkNoteEmbeds` runs last, after the other
  // transforms, so a spliced-in embedded body isn't touched by them a second time.
  const remark = unified()
    .use(remarkParse)
    .use(remarkGfm)
    // Parse `$…$` / `$$…$$` into math nodes before the text-node transforms below,
    // so a `$`-delimited expression is never mistaken for prose or a `[[wikilink]]`.
    .use(remarkMath)
    // Turn `> [!type]` blockquotes into callout cards before the text-node passes
    // below, which still reach the `[[wikilinks]]`/`$math$` inside a callout.
    .use(remarkCallouts)
    .use(remarkObsidianLinks, resolve, attachments)
    .use(remarkAttachmentImages, attachments)
    .use(remarkHeadings)
    .use(remarkNoteEmbeds, sources, renderInner);

  // mdast → hast, kept separate so it runs once over the fully-assembled tree.
  // Render the math nodes to KaTeX HTML at build time (`.katex` markup + MathML),
  // so no math library ships to the client — only KaTeX's stylesheet does, loaded
  // on the note route (see `#/routes/notes.$slug`). After `rehypeRaw` so it also
  // catches math inside any inline HTML the notes carry. Bad expressions render as
  // an inline error rather than failing the build (KaTeX's `throwOnError: false`).
  const toHast = unified()
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeKatex);

  function toMdast(raw: string, title: string, stack: string[]): { tree: Root; file: VFile } {
    const file = new VFile({ value: matter(raw).content, data: { title, embedStack: stack } });
    const tree = remark.runSync(remark.parse(file), file) as Root;
    return { tree, file };
  }

  function renderInner(raw: string, title: string, stack: string[]): RootContent[] {
    const { tree } = toMdast(raw, title, stack);
    stripFootnotes(tree);
    return tree.children;
  }

  return (raw, title, slug) => {
    const { tree, file } = toMdast(raw, title, slug === undefined ? [] : [slug]);
    const body = toHast.runSync(tree, file) as HastRoot;
    return { body, footnotes: detachFootnotes(body) };
  };
}

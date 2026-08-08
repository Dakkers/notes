import matter from "gray-matter";
import type { Nodes, Root } from "mdast";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { visit } from "unist-util-visit";

import type { Note, NoteLink } from "./types";

// Markdown structure (frontmatter split, heading nodes, code fencing) is handled
// by gray-matter + remark. The only bespoke patterns are the two Obsidian
// extensions that aren't part of CommonMark/GFM, and we run them over prose
// `text` nodes only — so `#tags`/`[[links]]` sitting inside code are ignored for
// free, because remark parks those in separate `code`/`inlineCode` nodes.
const LINK_RE = /(!?)\[\[([^\]]+)\]\]/g;
const TAG_RE = /(?:^|\s)#([^\s#]+)/g;

// Filename prefix: a Zettelkasten timestamp id (8–14 digits) then the title.
const ID_RE = /^(\d{8,14})\s+(.+)$/;

const markdown = unified().use(remarkParse).use(remarkGfm);

/** Fallback slug for id-less notes: lowercase, non-word runs → single dashes. */
function slugify(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^\w]+/g, "-")
      .replace(/^-+|-+$/g, "") || "note"
  );
}

/** Concatenate the visible text of an mdast node (headings, paragraphs, …). */
function textOf(node: Nodes): string {
  let out = "";
  visit(node, (child) => {
    if (child.type === "text" || child.type === "inlineCode") out += child.value;
  });
  return out;
}

/** Parse one note's filename + raw markdown into its {@link Note} metadata. */
export function parseNote(fileName: string, raw: string): Note {
  const name = fileName.replace(/\.md$/i, "");

  const idMatch = ID_RE.exec(name);
  const id = idMatch ? idMatch[1] : null;
  const title = idMatch ? idMatch[2] : name;
  const slug = id ?? slugify(name);

  const { data: frontmatter, content } = matter(raw);
  const tree = markdown.parse(content) as Root;

  let heading: string | null = null;
  const links: NoteLink[] = [];
  const tags: string[] = [];
  let wordCount = 0;

  const addTag = (tag: string) => {
    if (!tags.includes(tag)) tags.push(tag);
  };

  visit(tree, (node) => {
    if (node.type === "heading" && heading === null) {
      heading = textOf(node);
      return;
    }
    // Obsidian syntax lives in prose text; code nodes are deliberately skipped.
    if (node.type !== "text") return;

    for (const match of node.value.matchAll(LINK_RE)) {
      const [target, alias] = match[2].split("|");
      const link: NoteLink = { target: target.trim(), embed: match[1] === "!" };
      if (alias !== undefined) link.alias = alias.trim();
      links.push(link);
    }
    for (const match of node.value.matchAll(TAG_RE)) addTag(match[1]);

    const words = node.value.trim();
    if (words !== "") wordCount += words.split(/\s+/).length;
  });

  // Obsidian treats frontmatter `tags` and inline `#tags` as one set.
  for (const tag of normalizeFrontmatterTags(frontmatter.tags)) addTag(tag);

  // A stub note: frontmatter aside, nothing has been written in the body yet.
  const empty = content.trim() === "";

  // `backlinks`/`outgoingLinks` need the whole vault; the plugin fills them after
  // every note parses.
  return {
    fileName,
    name,
    id,
    slug,
    title,
    frontmatter,
    heading,
    links,
    backlinks: [],
    outgoingLinks: [],
    tags,
    wordCount,
    empty,
  };
}

/** Coerce a frontmatter `tags` value (list, or comma/space string) to a string[]. */
function normalizeFrontmatterTags(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[,\s]+/) : [];
  return raw.map((tag) => String(tag).trim()).filter((tag) => tag !== "");
}

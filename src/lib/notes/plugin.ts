import { readFileSync, readdirSync } from "node:fs";
import { extname, join, resolve } from "node:path";

import type { Root as HastRoot } from "hast";
import type { Plugin } from "vite";

import { type Attachment, buildAttachmentIndex, IMAGE_MIME } from "./attachments";
import { attachBacklinks, attachOutgoingLinks, buildResolver } from "./graph";
import { parseNote } from "./parse";
import { createNoteRenderer } from "./render";
import type { Note } from "./types";

// Two modules from one scan: lightweight metadata, and the heavier rendered body
// trees. Rollup convention: a resolved virtual id is prefixed with `\0` so other
// plugins (and the bundler's fs layer) leave it alone.
const MODULES = {
  "virtual:demo-notes": "\0virtual:demo-notes",
  "virtual:demo-notes/content": "\0virtual:demo-notes/content",
} as const;

interface DemoNotesOptions {
  /** Folder to scan, relative to the Vite project root. Defaults to `.demo`. */
  dir?: string;
  /**
   * Folder holding the vault's image attachments (Obsidian's "Files"/attachments
   * dir), relative to the project root or absolute. When set, `![[image.png]]`
   * embeds and relative markdown images resolve to files here, which are emitted
   * into the client build as static assets. Omitted in demo mode → no images.
   */
  attachmentsDir?: string;
  /**
   * Folder holding transclusion-only notes (e.g. Obsidian's `_Meta/Embed`
   * snippets) that live outside the main notes dir. Their bodies become available
   * to `![[note]]` embeds and their names resolve, but they are *not* emitted as
   * routable pages, don't appear in listings, and aren't part of the link graph.
   * Omitted → only notes inside `dir` can be transcluded.
   */
  embedsDir?: string;
}

/**
 * Exposes the parsed `.demo` notes to the app as two virtual modules:
 *  - `virtual:demo-notes` — `notes: Note[]`, the metadata (imported app-wide).
 *  - `virtual:demo-notes/content` — `content: Record<slug, HastRoot>`, rendered
 *    body trees (imported only by the note page route, so metadata consumers stay lean).
 *
 * The scan runs in the Vite/Node process — at dev-server start (and again on any
 * `.demo` change, via the watcher below) and once per `vite build`. Results are
 * serialized straight into the modules, so production bundles carry both as
 * static artifacts and never touch the filesystem at request time.
 *
 * Image attachments (`![[image.png]]` and relative markdown images) are resolved
 * against `attachmentsDir` to content-hashed `/attachments/…` URLs. The referenced
 * files are served from the vault in dev and emitted into the client bundle at
 * build (see `generateBundle` and `configureServer`), so only images that notes
 * actually embed ship — the rest of the vault stays out.
 */
export function demoNotes({
  dir = ".demo",
  attachmentsDir,
  embedsDir,
}: DemoNotesOptions = {}): Plugin {
  let notesDir: string;
  // Absolute path to the attachments folder, or undefined in demo mode.
  let attachmentsPath: string | undefined;
  // Absolute path to the transclusion-only embeds folder, or undefined when unset.
  let embedsPath: string | undefined;
  // Whether the current build is the SSR (server) bundle. Static assets belong in
  // the client bundle only, so the emit step below skips the server build.
  let isSsrBuild = false;
  // The attachments actually referenced by the notes, captured on the last content
  // render and emitted into the client bundle. Empty until `renderContent` runs.
  let referenced: Attachment[] = [];

  function readAll(fromDir: string): { fileName: string; raw: string }[] {
    return readdirSync(fromDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map((entry) => entry.name)
      .sort()
      .map((fileName) => ({ fileName, raw: readFileSync(join(fromDir, fileName), "utf8") }));
  }

  // One scan → notes with backlinks attached, plus the shared link resolver both
  // the metadata and the rendered content are derived from. Embed-only notes (from
  // `embedsPath`) feed the resolver so `![[Embed/…]]` targets resolve, but stay out
  // of the routable `notes` — see `renderContent` for how they're transcluded.
  function build(): {
    files: { fileName: string; raw: string }[];
    notes: Note[];
    embedFiles: { fileName: string; raw: string }[];
    embedNotes: Note[];
    resolve: ReturnType<typeof buildResolver>;
  } {
    const files = readAll(notesDir);
    const notes = files.map(({ fileName, raw }) => parseNote(fileName, raw));
    const embedFiles = embedsPath === undefined ? [] : readAll(embedsPath);
    const embedNotes = embedFiles.map(({ fileName, raw }) => parseNote(fileName, raw));
    const resolve = buildResolver(notes, embedNotes);
    attachBacklinks(notes, resolve);
    attachOutgoingLinks(notes, resolve);
    return { files, notes, embedFiles, embedNotes, resolve };
  }

  // Rendered bodies keyed by slug, plus the footnote trees for the notes that have
  // them (absent keys → no footnotes), so the note page can place footnotes in the
  // side panel rather than at the foot of the article.
  function renderContent(): {
    bodies: Record<string, HastRoot>;
    footnotes: Record<string, HastRoot>;
    raw: Record<string, string>;
  } {
    const { files, notes, embedFiles, embedNotes, resolve } = build();
    const attachments = buildAttachmentIndex(attachmentsPath);
    // Raw bodies keyed by slug, so `![[note]]` embeds can transclude one another.
    const sources = new Map(
      notes.map((note, i) => [note.slug, { raw: files[i].raw, title: note.title, routable: true }]),
    );
    // Embed-only sources are transcludable and resolvable but have no page, so they
    // render without the card's back-link. Registered after the routable notes and
    // skipped on a slug collision, so a real note always wins.
    for (const [i, note] of embedNotes.entries()) {
      if (!sources.has(note.slug))
        sources.set(note.slug, { raw: embedFiles[i].raw, title: note.title, routable: false });
    }
    const render = createNoteRenderer(resolve, attachments, sources);

    const bodies: Record<string, HastRoot> = {};
    const footnotes: Record<string, HastRoot> = {};
    // The verbatim `.md` source per note, so the note page can offer a "view raw
    // markdown" modal. Unlike the rest of the vault, these routable-note sources
    // are already public (their rendered form ships), so shipping the source too
    // leaks nothing the reader can't already reconstruct.
    const raw: Record<string, string> = {};
    for (const [i, { raw: source }] of files.entries()) {
      const rendered = render(source, notes[i].title, notes[i].slug);
      bodies[notes[i].slug] = rendered.body;
      if (rendered.footnotes !== null) footnotes[notes[i].slug] = rendered.footnotes;
      raw[notes[i].slug] = source;
    }
    // Record which attachments the notes actually embed, so `generateBundle` emits
    // just those (not the whole vault) into the client bundle.
    referenced = attachments.used();
    return { bodies, footnotes, raw };
  }

  return {
    name: "demo-notes",

    configResolved(config) {
      notesDir = resolve(config.root, dir);
      attachmentsPath =
        attachmentsDir === undefined ? undefined : resolve(config.root, attachmentsDir);
      embedsPath = embedsDir === undefined ? undefined : resolve(config.root, embedsDir);
      isSsrBuild = config.build.ssr !== false && config.build.ssr !== undefined;
    },

    resolveId(id) {
      if (id in MODULES) return MODULES[id as keyof typeof MODULES];
    },

    load(id) {
      if (id === MODULES["virtual:demo-notes"]) {
        return `export const notes = ${JSON.stringify(build().notes)};\n`;
      }
      if (id === MODULES["virtual:demo-notes/content"]) {
        const { bodies, footnotes, raw } = renderContent();
        // Drop parser `position` data — it bloats the serialized tree and the app
        // never reads it.
        const stripPosition = (key: string, value: unknown) =>
          key === "position" ? undefined : value;
        return (
          `export const content = ${JSON.stringify(bodies, stripPosition)};\n` +
          `export const footnotes = ${JSON.stringify(footnotes, stripPosition)};\n` +
          `export const raw = ${JSON.stringify(raw)};\n`
        );
      }
    },

    // Copy the referenced attachments into the client bundle as static assets, at
    // the content-hashed paths the rendered `<img>` tags point to. Only the client
    // bundle serves static files, so the SSR build is skipped. `renderContent` has
    // already run by this point (the content module is imported by the note route),
    // so `referenced` is populated.
    generateBundle() {
      // Prefer Vite 6+'s per-hook environment; fall back to the resolved-config flag.
      const envName = (this as { environment?: { name?: string } }).environment?.name;
      const isClient = envName === undefined ? !isSsrBuild : envName === "client";
      if (!isClient) return;

      for (const att of referenced) {
        this.emitFile({
          type: "asset",
          fileName: att.url.slice(1), // strip the leading "/" → "attachments/<hash><ext>"
          source: readFileSync(att.absPath),
        });
      }
    },

    configureServer(server) {
      // The `.demo` dir (and the attachments folder) sit outside `src`, so Vite
      // isn't already watching them.
      server.watcher.add(notesDir);
      if (attachmentsPath !== undefined) server.watcher.add(attachmentsPath);
      if (embedsPath !== undefined) server.watcher.add(embedsPath);

      // Serve `/attachments/<hash><ext>` from the vault. The URL carries a content
      // hash, not a filename, so map it back by hashing the vault's images once
      // (lazily, on first request) and caching until they change.
      let byUrl: Map<string, string> | null = null;
      const attachmentPathFor = (url: string): string | undefined => {
        if (byUrl === null) {
          byUrl = new Map();
          for (const att of buildAttachmentIndex(attachmentsPath).all())
            byUrl.set(att.url, att.absPath);
        }
        return byUrl.get(url);
      };

      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? "").split("?", 1)[0];
        if (!url.startsWith("/attachments/")) return next();
        const absPath = attachmentPathFor(url);
        if (absPath === undefined) return next();
        const mime = IMAGE_MIME[extname(absPath).toLowerCase()];
        if (mime !== undefined) res.setHeader("Content-Type", mime);
        res.end(readFileSync(absPath));
      });

      const reload = (file: string) => {
        const inNotes = file.startsWith(notesDir);
        const inAttachments = attachmentsPath !== undefined && file.startsWith(attachmentsPath);
        const inEmbeds = embedsPath !== undefined && file.startsWith(embedsPath);
        if (!inNotes && !inAttachments && !inEmbeds) return;
        // A changed image gets a new content hash (and URL), so drop the reverse map
        // and re-render the notes that reference it.
        if (inAttachments) byUrl = null;
        for (const resolvedId of Object.values(MODULES)) {
          const mod = server.moduleGraph.getModuleById(resolvedId);
          if (mod) server.moduleGraph.invalidateModule(mod);
        }
        // Notes feed server-rendered output, so re-run the whole document rather
        // than trying to hot-swap just the modules.
        server.ws.send({ type: "full-reload" });
      };

      server.watcher.on("add", reload);
      server.watcher.on("change", reload);
      server.watcher.on("unlink", reload);
    },
  };
}

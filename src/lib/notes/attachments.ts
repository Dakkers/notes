import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { basename, extname, join } from "node:path";

// Image extensions we serve from the vault as static assets (lowercased, with the
// leading dot). Obsidian embeds other file types too (PDF, `.canvas`), but only
// images render inline, so that's all this handles.
const IMAGE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".webp",
  ".avif",
  ".bmp",
]);

/** `Content-Type` per image extension, for serving attachments off the dev server. */
export const IMAGE_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".bmp": "image/bmp",
};

export interface Attachment {
  /** Absolute path to the source file in the vault. */
  absPath: string;
  /** Lowercased extension including the dot (e.g. `".png"`). */
  ext: string;
  /**
   * Root-absolute URL the site serves the file at: `/attachments/<hash><ext>`.
   * The `<hash>` is a content hash, so the URL is stable across builds and safe to
   * cache forever — a changed image simply gets a new URL.
   */
  url: string;
}

export interface AttachmentIndex {
  /**
   * Resolve an embed/image reference to an attachment, or null when the vault has
   * no such file. Matching is by basename, case-insensitively — how Obsidian
   * resolves `![[image.png]]` regardless of the note's folder. Callers strip any
   * `|size` suffix first. Resolving marks the file *used* (see {@link used}).
   */
  resolve(reference: string): Attachment | null;
  /** The attachments resolved so far — the set to emit into the build output. */
  used(): Attachment[];
  /** Every image in the vault, resolved (hashes computed) — used to serve them in dev. */
  all(): Attachment[];
}

function isImage(ext: string): boolean {
  return IMAGE_EXTENSIONS.has(ext);
}

/** Absolute paths of every file under `dir`, recursively. */
function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(path));
    else if (entry.isFile()) out.push(path);
  }
  return out;
}

/**
 * Index the vault's attachment folder so the note renderer can turn image embeds
 * (`![[image.png]]`) and relative markdown images (`![](image.png)`) into stable,
 * content-hashed URLs the site serves as static assets.
 *
 * Runs on the build machine only (inside the Vite plugin). `dir` is an absolute
 * path to the vault's attachments, or `undefined` in demo mode — which yields an
 * empty index where every `resolve` returns null.
 */
export function buildAttachmentIndex(dir: string | undefined): AttachmentIndex {
  // Lowercased basename → absolute source path. On the rare basename collision the
  // last file scanned wins; Obsidian's own name resolution is likewise ambiguous.
  const byBasename = new Map<string, string>();
  if (dir !== undefined) {
    for (const path of walk(dir)) {
      const ext = extname(path).toLowerCase();
      if (isImage(ext)) byBasename.set(basename(path).toLowerCase(), path);
    }
  }

  // Memoized per source path, so a file embedded by many notes is read and hashed
  // once and shares a single URL.
  const resolved = new Map<string, Attachment>();

  function attachmentFor(absPath: string): Attachment {
    let att = resolved.get(absPath);
    if (att === undefined) {
      const ext = extname(absPath).toLowerCase();
      const hash = createHash("sha256").update(readFileSync(absPath)).digest("hex").slice(0, 12);
      att = { absPath, ext, url: `/attachments/${hash}${ext}` };
      resolved.set(absPath, att);
    }
    return att;
  }

  return {
    resolve(reference) {
      const key = basename(reference.trim()).toLowerCase();
      const absPath = key === "" ? undefined : byBasename.get(key);
      return absPath === undefined ? null : attachmentFor(absPath);
    },
    used: () => [...resolved.values()],
    all: () => [...byBasename.values()].map(attachmentFor),
  };
}

/** An index with no attachments — the default when a renderer runs without a vault. */
export function emptyAttachmentIndex(): AttachmentIndex {
  return buildAttachmentIndex(undefined);
}

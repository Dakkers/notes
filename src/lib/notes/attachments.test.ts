import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildAttachmentIndex, emptyAttachmentIndex } from "./attachments";

// A throwaway vault with a couple of images (one nested), a duplicate of one by a
// different name, and a non-image file — enough to exercise resolution, hashing,
// and the image-only filter without committing any binaries to the repo.
let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "attachments-"));
  writeFileSync(join(dir, "Diagram.png"), "diagram-bytes");
  writeFileSync(join(dir, "Copy of diagram.png"), "diagram-bytes"); // same content, different name
  mkdirSync(join(dir, "sub"));
  writeFileSync(join(dir, "sub", "Nested.jpg"), "nested-bytes");
  writeFileSync(join(dir, "notes.pdf"), "pdf-bytes"); // not an image
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("buildAttachmentIndex", () => {
  it("resolves images by basename, case-insensitively and ignoring any folder", () => {
    const index = buildAttachmentIndex(dir);
    const url = "/attachments/";

    expect(index.resolve("Diagram.png")?.url).toMatch(new RegExp(`^${url}[0-9a-f]{12}\\.png$`));
    // Case-insensitive, and a leading folder in the reference is ignored.
    expect(index.resolve("diagram.png")?.url).toBe(index.resolve("Diagram.png")?.url);
    expect(index.resolve("_Meta/Files/DIAGRAM.PNG")?.url).toBe(index.resolve("Diagram.png")?.url);
    // Nested files are found by the recursive walk.
    expect(index.resolve("Nested.jpg")?.ext).toBe(".jpg");
  });

  it("returns null for unknown and non-image references", () => {
    const index = buildAttachmentIndex(dir);
    expect(index.resolve("does-not-exist.png")).toBeNull();
    expect(index.resolve("notes.pdf")).toBeNull(); // present, but not an image
    expect(index.resolve("")).toBeNull();
  });

  it("keys URLs by content, so identical files share one URL", () => {
    const index = buildAttachmentIndex(dir);
    // Same bytes under two names → same content hash → same served URL.
    expect(index.resolve("Copy of diagram.png")?.url).toBe(index.resolve("Diagram.png")?.url);
    // Different bytes → different URL.
    expect(index.resolve("Nested.jpg")?.url).not.toBe(index.resolve("Diagram.png")?.url);
  });

  it("tracks only resolved files in used(), and every image in all()", () => {
    const index = buildAttachmentIndex(dir);
    expect(index.used()).toHaveLength(0);

    index.resolve("Diagram.png");
    index.resolve("Copy of diagram.png"); // same content, already memoized by path
    expect(index.used()).toHaveLength(2); // two distinct source files, resolved

    // all() covers the three images (both PNGs + the JPG), never the PDF.
    expect(index.all()).toHaveLength(3);
  });

  it("is empty when given no directory (demo mode)", () => {
    const index = emptyAttachmentIndex();
    expect(index.resolve("Diagram.png")).toBeNull();
    expect(index.all()).toHaveLength(0);
  });
});

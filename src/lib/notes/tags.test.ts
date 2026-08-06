import { describe, expect, it } from "vitest";

import { isHiddenTag, tagIntent, visibleTags } from "./tags";

describe("isHiddenTag", () => {
  it("hides the Meta namespace root and any nesting beneath it", () => {
    expect(isHiddenTag("Meta")).toBe(true);
    expect(isHiddenTag("Meta/status")).toBe(true);
    expect(isHiddenTag("Meta/a/b")).toBe(true);
  });

  it("matches the namespace case-insensitively", () => {
    expect(isHiddenTag("meta")).toBe(true);
    expect(isHiddenTag("META/Draft")).toBe(true);
  });

  it("keeps unrelated tags, including ones that merely start with 'meta'", () => {
    expect(isHiddenTag("Dev")).toBe(false);
    expect(isHiddenTag("Metadata")).toBe(false);
    expect(isHiddenTag("Metaphor")).toBe(false);
  });
});

describe("visibleTags", () => {
  it("drops hidden tags while preserving order of the rest", () => {
    expect(visibleTags(["Dev", "Meta/status", "🔗", "meta"])).toEqual(["Dev", "🔗"]);
  });
});

describe("tagIntent", () => {
  it("maps each top-level namespace to its intent", () => {
    expect(tagIntent("Music")).toBe("primary");
    expect(tagIntent("Dev")).toBe("secondary");
    expect(tagIntent("AudioEngineering")).toBe("positive");
  });

  it("makes child tags inherit their parent namespace's intent", () => {
    expect(tagIntent("Music/Harmony")).toBe("primary");
    expect(tagIntent("Music/Harmony/Jazz")).toBe("primary");
    expect(tagIntent("Dev/Postgres")).toBe("secondary");
    expect(tagIntent("AudioEngineering/DigitalAudio")).toBe("positive");
  });

  it("matches the namespace case-insensitively", () => {
    expect(tagIntent("music")).toBe("primary");
    expect(tagIntent("DEV/postgres")).toBe("secondary");
  });

  it("falls back to neutral for unmapped namespaces", () => {
    expect(tagIntent("🔗")).toBe("neutral");
    expect(tagIntent("Cooking")).toBe("neutral");
  });
});

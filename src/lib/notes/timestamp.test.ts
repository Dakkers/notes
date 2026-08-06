import { describe, expect, it } from "vitest";

import { formatWrittenAt } from "./timestamp";

describe("formatWrittenAt", () => {
  it("formats a full YYYYMMDDHHmmss id as a date plus 24-hour time", () => {
    expect(formatWrittenAt("20220403105600")).toEqual({
      date: "April 3, 2022",
      time: "10:56",
    });
  });

  it("keeps the time once hours and minutes are present, ignoring missing seconds", () => {
    expect(formatWrittenAt("202204031056")).toEqual({ date: "April 3, 2022", time: "10:56" });
  });

  it("drops the time for a date-only id", () => {
    expect(formatWrittenAt("20220403")).toEqual({ date: "April 3, 2022", time: null });
  });

  it("returns null for a missing id or one that isn't a timestamp", () => {
    expect(formatWrittenAt(null)).toBeNull();
    expect(formatWrittenAt("belkin-2018")).toBeNull();
    expect(formatWrittenAt("1234")).toBeNull();
  });

  it("returns null when the fields are out of range", () => {
    expect(formatWrittenAt("20221340105600")).toBeNull(); // month 13
    expect(formatWrittenAt("20220403256000")).toBeNull(); // hour 25
  });
});

import { describe, expect, it } from "vitest";

import { byTitle } from "./sort";

const order = (titles: string[]) =>
  titles
    .map((title) => ({ title }))
    .sort(byTitle)
    .map((n) => n.title);

describe("byTitle", () => {
  it("ignores leading quotes so a quoted title files under its first letter", () => {
    expect(order(['"Cadence" vs "cadential progression"', "Bit depth", "Cadences"])).toEqual([
      "Bit depth",
      '"Cadence" vs "cadential progression"',
      "Cadences",
    ]);
  });

  it("is case- and accent-insensitive", () => {
    expect(order(["zebra", "Apple", "éclair"])).toEqual(["Apple", "éclair", "zebra"]);
  });

  it("ignores curly as well as straight quotes", () => {
    expect(order(["“beta”", "alpha", "'gamma'"])).toEqual(["alpha", "“beta”", "'gamma'"]);
  });

  it("ignores a leading degree sign so `°7 chords` sorts as `7 chords`", () => {
    // The degree-led title files with the number-led notes, not near the letter "o".
    expect(order(["Oboe", "°7 chords", "2-chord trick", "Alpha chord"])).toEqual([
      "2-chord trick",
      "°7 chords",
      "Alpha chord",
      "Oboe",
    ]);
  });
});

/**
 * Read a note's "written" moment out of its Zettelkasten id. The id is the
 * filename's leading `YYYYMMDDHHmmss` run (8–14 digits; see `#/lib/notes/parse`),
 * so it already encodes when the note was created — no `stat`/mtime needed.
 *
 * Formatting is done from the integer fields directly (not through a `Date`), so
 * the string is identical on the server and in the browser regardless of their
 * time zones — a `Date` round-trip would risk a hydration mismatch.
 */

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** A note's written timestamp, split into a date line and an optional time line. */
export interface WrittenAt {
  /** e.g. `"April 3, 2022"`. */
  date: string;
  /** 24-hour `"HH:mm"`, or null when the id carries only a date. */
  time: string | null;
}

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

/**
 * Turn a Zettelkasten id into a human date (and time, when the id encodes one),
 * or null when it isn't a usable timestamp. Time is only surfaced once the id is
 * long enough to hold hours *and* minutes (≥ 12 digits); a bare `YYYYMMDD`
 * yields a date with no time.
 */
export function formatWrittenAt(id: string | null): WrittenAt | null {
  if (id === null || !/^\d{8,14}$/.test(id)) return null;

  const year = Number(id.slice(0, 4));
  const month = Number(id.slice(4, 6));
  const day = Number(id.slice(6, 8));
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const hasTime = id.length >= 12;
  const hour = Number(id.slice(8, 10) || "0");
  const minute = Number(id.slice(10, 12) || "0");
  if (hasTime && (hour > 23 || minute > 59)) return null;

  return {
    date: `${MONTHS[month - 1]} ${day}, ${year}`,
    time: hasTime ? `${pad(hour)}:${pad(minute)}` : null,
  };
}

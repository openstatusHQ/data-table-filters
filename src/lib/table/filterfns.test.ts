import { describe, expect, it } from "vitest";
import { arrSome, inDateRange } from "./filterfns";

/** Minimal row mock — only the getValue method is needed. */
function makeRow(value: unknown) {
  return { getValue: (_columnId: string) => value } as any;
}

// ── inDateRange ───────────────────────────────────────────────────────────────

describe("inDateRange", () => {
  it("returns false for an invalid (non-parseable) date value", () => {
    const row = makeRow("not-a-date");
    expect(inDateRange(row, "date", [new Date()])).toBe(false);
  });

  it("returns true when the row date falls on the same day as start (no end)", () => {
    const start = new Date(2024, 0, 15); // Jan 15 local time
    const noon = new Date(2024, 0, 15, 12); // Jan 15 noon local time
    expect(inDateRange(makeRow(noon), "date", [start, undefined])).toBe(true);
  });

  it("returns false when the row date is on a different day than start (no end)", () => {
    const start = new Date(2024, 0, 15); // Jan 15
    const next = new Date(2024, 0, 16); // Jan 16
    expect(inDateRange(makeRow(next), "date", [start, undefined])).toBe(false);
  });

  it("returns true when the row date is strictly between start and end", () => {
    const start = new Date(2024, 0, 1); // Jan 1
    const end = new Date(2024, 0, 31); // Jan 31
    const mid = new Date(2024, 0, 15); // Jan 15
    expect(inDateRange(makeRow(mid), "date", [start, end])).toBe(true);
  });

  it("returns false when the row date is before start", () => {
    const start = new Date(2024, 0, 1); // Jan 1 2024
    const end = new Date(2024, 0, 31); // Jan 31 2024
    const before = new Date(2023, 11, 31); // Dec 31 2023
    expect(inDateRange(makeRow(before), "date", [start, end])).toBe(false);
  });

  it("returns false when the row date is after end", () => {
    const start = new Date(2024, 0, 1); // Jan 1
    const end = new Date(2024, 0, 31); // Jan 31
    const after = new Date(2024, 1, 1); // Feb 1
    expect(inDateRange(makeRow(after), "date", [start, end])).toBe(false);
  });

  it("accepts a Date object as the row value (not just a string)", () => {
    const start = new Date(2024, 0, 1);
    const end = new Date(2024, 0, 31);
    const date = new Date(2024, 0, 10);
    expect(inDateRange(makeRow(date), "date", [start, end])).toBe(true);
  });
});

// ── inDateRange.autoRemove ────────────────────────────────────────────────────

describe("inDateRange.autoRemove", () => {
  it("removes when value is not an array", () => {
    expect(inDateRange.autoRemove!("not-array")).toBe(true);
    expect(inDateRange.autoRemove!(null)).toBe(true);
    expect(inDateRange.autoRemove!(undefined)).toBe(true);
  });

  it("removes when value is an empty array", () => {
    expect(inDateRange.autoRemove!([])).toBe(true);
  });

  it("removes when the array contains strings instead of Date objects", () => {
    expect(inDateRange.autoRemove!(["2024-01-01", "2024-01-31"])).toBe(true);
  });

  it("does not remove when value is a non-empty array of Date objects", () => {
    expect(inDateRange.autoRemove!([new Date(), new Date()])).toBe(false);
  });
});

// ── arrSome ───────────────────────────────────────────────────────────────────

describe("arrSome", () => {
  it("returns false when filterValue is not an array", () => {
    const row = makeRow("error");
    expect(arrSome(row, "level", "error")).toBe(false);
    expect(arrSome(row, "level", null)).toBe(false);
  });

  it("returns false when no element in filterValue matches the row value", () => {
    const row = makeRow("info");
    expect(arrSome(row, "level", ["error", "warn"])).toBe(false);
  });

  it("returns true when one element in filterValue matches the row value", () => {
    const row = makeRow("error");
    expect(arrSome(row, "level", ["error", "warn"])).toBe(true);
  });

  it("uses strict equality (===) for matching", () => {
    // Number 200 should not match string "200"
    const row = makeRow(200);
    expect(arrSome(row, "status", ["200"])).toBe(false);
    expect(arrSome(row, "status", [200])).toBe(true);
  });
});

// ── arrSome.autoRemove ────────────────────────────────────────────────────────

describe("arrSome.autoRemove", () => {
  it("removes when value is not an array", () => {
    expect(arrSome.autoRemove!("not-array")).toBe(true);
    expect(arrSome.autoRemove!(null)).toBe(true);
  });

  it("removes when value is an empty array", () => {
    expect(arrSome.autoRemove!([])).toBe(true);
  });

  it("does not remove when value is a non-empty array", () => {
    expect(arrSome.autoRemove!(["error"])).toBe(false);
    expect(arrSome.autoRemove!([200, 404])).toBe(false);
  });
});

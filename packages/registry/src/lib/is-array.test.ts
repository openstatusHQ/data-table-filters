import { describe, expect, it } from "vitest";
import {
  isArrayOfBooleans,
  isArrayOfDates,
  isArrayOfNumbers,
  isArrayOfStrings,
} from "./is-array";

// ── isArrayOfNumbers ──────────────────────────────────────────────────────────

describe("isArrayOfNumbers", () => {
  it("returns true for an array of numbers", () => {
    expect(isArrayOfNumbers([1, 2, 3])).toBe(true);
  });

  it("returns true for an empty array", () => {
    expect(isArrayOfNumbers([])).toBe(true);
  });

  it("returns false for a non-array value", () => {
    expect(isArrayOfNumbers("hello")).toBe(false);
    expect(isArrayOfNumbers(42)).toBe(false);
    expect(isArrayOfNumbers(null)).toBe(false);
    expect(isArrayOfNumbers(undefined)).toBe(false);
  });

  it("returns false when any element is not a number", () => {
    expect(isArrayOfNumbers([1, "two", 3])).toBe(false);
    expect(isArrayOfNumbers([1, null, 3])).toBe(false);
    expect(isArrayOfNumbers([1, true, 3])).toBe(false);
  });

  it("returns true for an array containing NaN (typeof NaN === 'number')", () => {
    expect(isArrayOfNumbers([NaN])).toBe(true);
  });
});

// ── isArrayOfDates ────────────────────────────────────────────────────────────

describe("isArrayOfDates", () => {
  it("returns true for an array of Date objects", () => {
    expect(isArrayOfDates([new Date(), new Date("2024-01-01")])).toBe(true);
  });

  it("returns true for an empty array", () => {
    expect(isArrayOfDates([])).toBe(true);
  });

  it("returns false for a non-array value", () => {
    expect(isArrayOfDates("2024-01-01")).toBe(false);
    expect(isArrayOfDates(null)).toBe(false);
    expect(isArrayOfDates(undefined)).toBe(false);
  });

  it("returns false when any element is a date string (not a Date instance)", () => {
    expect(isArrayOfDates([new Date(), "2024-01-01"])).toBe(false);
  });

  it("returns false when any element is a unix ms number", () => {
    expect(isArrayOfDates([new Date(), 1704067200000])).toBe(false);
  });
});

// ── isArrayOfStrings ──────────────────────────────────────────────────────────

describe("isArrayOfStrings", () => {
  it("returns true for an array of strings", () => {
    expect(isArrayOfStrings(["a", "b", "c"])).toBe(true);
  });

  it("returns true for an empty array", () => {
    expect(isArrayOfStrings([])).toBe(true);
  });

  it("returns false for a non-array value", () => {
    expect(isArrayOfStrings(42)).toBe(false);
    expect(isArrayOfStrings(null)).toBe(false);
    expect(isArrayOfStrings(undefined)).toBe(false);
  });

  it("returns false when any element is not a string", () => {
    expect(isArrayOfStrings(["a", 2, "c"])).toBe(false);
    expect(isArrayOfStrings(["a", null])).toBe(false);
    expect(isArrayOfStrings(["a", true])).toBe(false);
  });
});

// ── isArrayOfBooleans ─────────────────────────────────────────────────────────

describe("isArrayOfBooleans", () => {
  it("returns true for an array of booleans", () => {
    expect(isArrayOfBooleans([true, false, true])).toBe(true);
  });

  it("returns true for an empty array", () => {
    expect(isArrayOfBooleans([])).toBe(true);
  });

  it("returns false for a non-array value", () => {
    expect(isArrayOfBooleans("true")).toBe(false);
    expect(isArrayOfBooleans(null)).toBe(false);
    expect(isArrayOfBooleans(undefined)).toBe(false);
  });

  it("returns false when any element is a truthy number instead of boolean", () => {
    expect(isArrayOfBooleans([true, 1, false])).toBe(false);
  });

  it("returns false when any element is a string 'true'", () => {
    expect(isArrayOfBooleans([true, "true"])).toBe(false);
  });
});

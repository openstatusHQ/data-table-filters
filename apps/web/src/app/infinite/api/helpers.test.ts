import { describe, expect, it } from "vitest";
import { evaluateInterval } from "./helpers";

// NOTE: filterData, sortData, splitData depend on ColumnSchema with Date objects
// and domain-specific constants. We test the pure utility functions here.

describe("evaluateInterval", () => {
  function makeDates(minutesApart: number): [Date, Date] {
    const start = new Date("2024-01-15T00:00:00Z");
    const end = new Date(start.getTime() + minutesApart * 60 * 1000);
    return [start, end];
  }

  it("returns 0 for null dates", () => {
    expect(evaluateInterval(null)).toBe(0);
  });

  it("returns 0 for empty array", () => {
    expect(evaluateInterval([])).toBe(0);
  });

  it("returns 0 for more than 3 dates", () => {
    const d = new Date();
    expect(evaluateInterval([d, d, d, d])).toBe(0);
  });

  it("returns 1s interval for < 1 minute apart", () => {
    expect(evaluateInterval(makeDates(0.5))).toBe(1000);
  });

  it("returns 5s interval for 1-5 minutes apart", () => {
    expect(evaluateInterval(makeDates(3))).toBe(5000);
  });

  it("returns 10s interval for 5-10 minutes apart", () => {
    expect(evaluateInterval(makeDates(7))).toBe(10000);
  });

  it("returns 30s interval for 10-30 minutes apart", () => {
    expect(evaluateInterval(makeDates(20))).toBe(30000);
  });

  it("returns 1min interval for 30-60 minutes apart", () => {
    expect(evaluateInterval(makeDates(45))).toBe(60000);
  });

  it("returns 2min interval for 60-120 minutes apart", () => {
    expect(evaluateInterval(makeDates(90))).toBe(120000);
  });

  it("returns default interval for very large time difference", () => {
    expect(evaluateInterval(makeDates(100000))).toBe(46080000);
  });

  it("handles dates in reverse order (uses absolute difference)", () => {
    const [start, end] = makeDates(45);
    // Reverse the order
    expect(evaluateInterval([end, start])).toBe(60000);
  });
});

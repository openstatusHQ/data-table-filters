import { describe, expect, it } from "vitest";
import {
  calculatePercentile,
  calculatePercentileRanks,
  calculateSpecificPercentile,
  getPercentileColor,
} from "./percentile";

describe("calculateSpecificPercentile", () => {
  const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

  it("calculates 50th percentile (median)", () => {
    const result = calculateSpecificPercentile(values, 50);
    expect(result).toBeCloseTo(55, 1);
  });

  it("calculates 90th percentile", () => {
    const result = calculateSpecificPercentile(values, 90);
    expect(result).toBeCloseTo(91, 0);
  });

  it("calculates 99th percentile", () => {
    const result = calculateSpecificPercentile(values, 99);
    expect(result).toBeCloseTo(99.1, 0);
  });

  it("handles single-element array", () => {
    expect(calculateSpecificPercentile([42], 50)).toBe(42);
  });

  it("handles unsorted input (sorts internally)", () => {
    const result = calculateSpecificPercentile([100, 10, 50, 30, 70], 50);
    expect(result).toBe(50);
  });

  it("does not mutate the input array", () => {
    const arr = [5, 3, 1, 4, 2];
    const original = [...arr];
    calculateSpecificPercentile(arr, 50);
    expect(arr).toEqual(original);
  });
});

describe("calculatePercentile", () => {
  const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

  it("returns 100 for the maximum value", () => {
    expect(calculatePercentile(values, 100)).toBe(100);
  });

  it("returns 10 for the minimum value", () => {
    expect(calculatePercentile(values, 10)).toBe(10);
  });

  it("returns correct rank for a middle value", () => {
    expect(calculatePercentile(values, 50)).toBe(50);
  });

  it("handles value greater than all", () => {
    expect(calculatePercentile(values, 200)).toBe(100);
  });

  it("handles value smaller than all", () => {
    expect(calculatePercentile(values, 1)).toBe(0);
  });
});

describe("getPercentileColor", () => {
  it("returns green for < 50", () => {
    expect(getPercentileColor(25).text).toContain("green");
  });

  it("returns yellow for 50-74", () => {
    expect(getPercentileColor(60).text).toContain("yellow");
  });

  it("returns orange for 75-89", () => {
    expect(getPercentileColor(80).text).toContain("orange");
  });

  it("returns red for >= 90", () => {
    expect(getPercentileColor(95).text).toContain("red");
  });

  it("returns green for 0", () => {
    expect(getPercentileColor(0).text).toContain("green");
  });

  it("returns red for 100", () => {
    expect(getPercentileColor(100).text).toContain("red");
  });
});

describe("calculatePercentileRanks", () => {
  const cases: number[][] = [
    [],
    [42],
    [10, 20, 30, 40, 50],
    [5, 5, 5, 5],
    [100, 1, 50, 1, 99],
    [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5],
  ];

  // The batch helper replaced a per-row calculatePercentile() call (which
  // re-sorted and re-scanned the whole array for every row). It must stay
  // numerically identical.
  it.each(cases.map((values) => [values]))(
    "matches calculatePercentile for %j",
    (input) => {
      expect(calculatePercentileRanks(input)).toEqual(
        input.map((value) => calculatePercentile(input, value)),
      );
    },
  );

  it("returns an empty array for no values", () => {
    expect(calculatePercentileRanks([])).toEqual([]);
  });

  it("preserves input order, not sorted order", () => {
    const [first, second, third] = calculatePercentileRanks([30, 10, 20]);
    expect(first).toBe(100);
    expect(second).toBeCloseTo(33.33, 2);
    expect(third).toBeCloseTo(66.67, 2);
  });

  it("gives tied values the same rank", () => {
    const ranks = calculatePercentileRanks([10, 20, 10, 30]);
    expect(ranks[0]).toBe(ranks[2]);
  });
});

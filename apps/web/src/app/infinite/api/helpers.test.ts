import { describe, expect, it } from "vitest";
import { evaluateInterval, groupChartData } from "./helpers";
import type { ColumnSchema } from "../schema";

// Filtering is no longer tested here: `filterData` is gone, and the semantics
// it used to implement are covered by the conformance corpus in
// `@dtf/registry/lib/filters`, which exercises this route's engine and the SQL
// engine against the same hand-written expectations.
//
// `evaluateInterval` stays because nothing else covers its 13-rung ladder.
// `sortData`, `splitData`, and `getFacetsFromData` remain untested — they 
// are chart/pagination concerns, not filter semantics. The `groupChartData` 
// function is actively tested due to core mathematical bucketing sensitivity.

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

describe("groupChartData", () => {
  const makeRow = (time: number, level: string = "success"): ColumnSchema => {
    return { date: new Date(time), level } as unknown as ColumnSchema;
  };

  it("returns empty array for empty data and null dates", () => {
    expect(groupChartData([], null)).toEqual([]);
  });

  it("handles a single data point correctly within intervals", () => {
    const start = new Date(1000);
    const end = new Date(11000);
    const row = makeRow(1000, "error");

    const result = groupChartData([row], [start, end]);
    // interval will evaluate to 1000ms based on 10s difference
    expect(result[0].error).toBe(1);
    expect(result[0].success).toBe(0);
    expect(result[0].timestamp).toBe(1000);
  });

  it("bucket boundaries align perfectly with interval segmentation", () => {
    // 3000ms duration with < 1min rules = 1000ms interval (3 steps).
    const start = new Date(1000);
    const end = new Date(4000);

    const rows = [
      makeRow(1000, "success"), // EXACT start edge -> bucket 0
      makeRow(1999, "warning"), // Before edge      -> bucket 0
      makeRow(2000, "error"),   // EXACT next edge  -> bucket 1
      makeRow(3500, "success"), // Mid bucket       -> bucket 2
    ];

    const result = groupChartData(rows, [start, end]);
    expect(result.length).toBe(3);

    expect(result[0].success).toBe(1);
    expect(result[0].warning).toBe(1);
    expect(result[0].error).toBe(0);

    expect(result[1].error).toBe(1);

    expect(result[2].success).toBe(1);
  });

  it("ignores rows falling outside generated buckets but within duration boundaries", () => {
    // Test the unallocated bucket edgecase noted in PR.
    // Start = 1000. End = 3500. duration = 2500. 
    // Evaluated interval = 1000ms. steps = Math.floor(2500/1000) = 2.
    // Creates bucket 0 (1000) and bucket 1 (2000) - Stops at 2999!
    const start = new Date(1000);
    const end = new Date(3500);

    const result = groupChartData([
      makeRow(1500, "success"), // falls in bucket 0
      makeRow(3200, "error")    // timeDiff is 2200 (within 2500 duration), but bucket 3 (index 2) does not exist!
    ], [start, end]);

    expect(result.length).toBe(2);
    expect(result[0].success).toBe(1);
    expect(result[1].error).toBe(0); // The 3200 'error' row maps to undefined bucketIndex 2 and is bypassed
  });
});

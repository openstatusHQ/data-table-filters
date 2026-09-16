import { describe, expect, it } from "vitest";
import { bucketChartData, chartRange } from "./chart-data";

type Row = { date: Date; level: string };
const LEVELS = ["success", "warning", "error"] as const;

const row = (time: number, level: string = "success"): Row => ({
  date: new Date(time),
  level,
});

const bucket = (rows: Row[], range: Date[] | null) =>
  bucketChartData(rows, {
    timestamp: (r) => r.date,
    series: (r) => r.level,
    keys: LEVELS,
    range,
  });

describe("chartRange", () => {
  it("is null with no rows and no range", () => {
    expect(chartRange([], (r: Row) => r.date, null)).toBeNull();
  });

  it("reads a single date as that whole day", () => {
    const day = new Date("2024-01-15T00:00:00Z");
    expect(chartRange([], (r: Row) => r.date, [day])).toEqual([
      day.getTime(),
      day.getTime() + 24 * 60 * 60 * 1000,
    ]);
  });

  it("orders a backwards range", () => {
    expect(
      chartRange([], (r: Row) => r.date, [new Date(5000), new Date(1000)]),
    ).toEqual([1000, 5000]);
  });

  it("falls back to the rows' own extent, whatever their order", () => {
    expect(
      chartRange([row(3000), row(1000), row(2000)], (r) => r.date, null),
    ).toEqual([1000, 3000]);
  });
});

describe("bucketChartData", () => {
  // The four cases below are the ones the demo route's `groupChartData` was
  // pinned by before the helper moved here; they must keep passing unchanged.
  it("returns an empty array for no rows and no range", () => {
    expect(bucket([], null)).toEqual([]);
  });

  it("counts a single row in its bucket and zeroes the other series", () => {
    // 10 s apart → 1 s buckets
    const result = bucket(
      [row(1000, "error")],
      [new Date(1000), new Date(11000)],
    );
    expect(result[0]).toEqual({
      timestamp: 1000,
      success: 0,
      warning: 0,
      error: 1,
    });
    expect(result).toHaveLength(10);
  });

  it("aligns bucket boundaries with the interval", () => {
    // 3 s → 1 s buckets, 3 of them
    const result = bucket(
      [
        row(1000, "success"), // exact start edge → bucket 0
        row(1999, "warning"), // just before the edge → bucket 0
        row(2000, "error"), // exact next edge → bucket 1
        row(3500, "success"), // mid bucket → bucket 2
      ],
      [new Date(1000), new Date(4000)],
    );
    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({ success: 1, warning: 1, error: 0 });
    expect(result[1]).toMatchObject({ error: 1 });
    expect(result[2]).toMatchObject({ success: 1 });
  });

  it("drops rows past the last whole bucket", () => {
    // 2.5 s → 1 s buckets, floor → 2 buckets; a row at 3200 has no bucket
    const result = bucket(
      [row(1500, "success"), row(3200, "error")],
      [new Date(1000), new Date(3500)],
    );
    expect(result).toHaveLength(2);
    expect(result[0].success).toBe(1);
    expect(result[1].error).toBe(0);
  });

  it("ignores a series it was not told about", () => {
    const result = bucket(
      [row(1000, "debug")],
      [new Date(1000), new Date(2000)],
    );
    expect(result[0]).toEqual({
      timestamp: 1000,
      success: 0,
      warning: 0,
      error: 0,
    });
  });

  it("honours a fixed interval", () => {
    const result = bucketChartData([row(0), row(5000), row(9000)], {
      timestamp: (r) => r.date,
      series: (r) => r.level,
      keys: LEVELS,
      range: [new Date(0), new Date(10000)],
      intervalMs: 5000,
    });
    expect(result.map((b) => b.timestamp)).toEqual([0, 5000]);
    expect(result.map((b) => b.success)).toEqual([1, 2]);
  });
});

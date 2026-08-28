import { describe, expect, it } from "vitest";
import {
  getFacetedMinMaxValues,
  getFacetedUniqueValues,
  getFacetedUniqueValuesFlattened,
} from "./faceted";
import type { FacetMetadataSchema } from "./types";

/**
 * Minimal table stub.
 *
 * `getFacetedUniqueValuesFlattened` touches exactly three things:
 * `table.getColumn(id)`, `column.getFacetedRowModel()`, and `row.getValue(id)`.
 * Driving it with a stub proves the flattening behaviour without a React
 * renderer — the registry's vitest environment is "node".
 */
function makeTable(rows: Array<Record<string, unknown>>, columnId = "regions") {
  return {
    getColumn: (id: string) =>
      id === columnId
        ? {
            getFacetedRowModel: () => ({
              flatRows: rows.map((row) => ({
                getValue: (key: string) => row[key],
              })),
            }),
          }
        : undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("getFacetedUniqueValuesFlattened", () => {
  it("counts each item of an array column individually", () => {
    const table = makeTable([
      { regions: ["ams", "fra"] },
      { regions: ["ams"] },
      { regions: ["gru", "fra", "ams"] },
    ]);

    const counts = getFacetedUniqueValuesFlattened()(table, "regions")();

    expect(counts.get("ams")).toBe(3);
    expect(counts.get("fra")).toBe(2);
    expect(counts.get("gru")).toBe(1);
    expect(counts.size).toBe(3);
  });

  it("counts a non-array column the same way the built-in does", () => {
    const table = makeTable(
      [{ method: "GET" }, { method: "GET" }, { method: "POST" }],
      "method",
    );

    const counts = getFacetedUniqueValuesFlattened()(table, "method")();

    expect(counts.get("GET")).toBe(2);
    expect(counts.get("POST")).toBe(1);
    expect(counts.size).toBe(2);
  });

  it("skips null and undefined scalars instead of counting them", () => {
    const table = makeTable(
      [{ method: "GET" }, { method: null }, { method: undefined }],
      "method",
    );

    const counts = getFacetedUniqueValuesFlattened()(table, "method")();

    expect(counts.size).toBe(1);
    expect(counts.get("GET")).toBe(1);
  });

  it("counts an empty array as no values rather than as one value", () => {
    const table = makeTable([{ regions: [] }, { regions: ["ams"] }]);

    const counts = getFacetedUniqueValuesFlattened()(table, "regions")();

    expect(counts.size).toBe(1);
    expect(counts.get("ams")).toBe(1);
  });

  it("handles a column that mixes array and scalar values", () => {
    const table = makeTable([
      { regions: ["ams", "fra"] },
      { regions: "ams" },
      { regions: null },
    ]);

    const counts = getFacetedUniqueValuesFlattened()(table, "regions")();

    expect(counts.get("ams")).toBe(2);
    expect(counts.get("fra")).toBe(1);
    expect(counts.size).toBe(2);
  });

  it("returns an empty map when the column does not exist", () => {
    const table = makeTable([{ regions: ["ams"] }]);

    const counts = getFacetedUniqueValuesFlattened()(table, "nope")();

    expect(counts.size).toBe(0);
  });

  it("preserves falsy-but-present values such as 0 and empty string", () => {
    const table = makeTable(
      [{ status: 0 }, { status: 0 }, { status: "" }],
      "status",
    );

    const counts = getFacetedUniqueValuesFlattened()(table, "status")();

    expect(counts.get(0)).toBe(2);
    expect(counts.get("")).toBe(1);
  });
});

const facets: Record<string, FacetMetadataSchema> = {
  level: {
    rows: [
      { value: "success", total: 120 },
      { value: "error", total: 8 },
    ],
    total: 128,
  },
  latency: { rows: [], total: 0, min: 12, max: 3400 },
  minOnly: { rows: [], total: 0, min: 5 },
  maxOnly: { rows: [], total: 0, max: 99 },
  neither: { rows: [], total: 0 },
};

describe("getFacetedUniqueValues (server facets)", () => {
  it("reads pre-computed counts off the response", () => {
    const read = getFacetedUniqueValues(facets);
    const counts = read(null, "level");

    expect(counts.get("success")).toBe(120);
    expect(counts.get("error")).toBe(8);
  });

  it("returns an empty map for an unknown column", () => {
    expect(getFacetedUniqueValues(facets)(null, "nope").size).toBe(0);
  });

  it("returns an empty map when no facets were supplied at all", () => {
    expect(getFacetedUniqueValues(undefined)(null, "level").size).toBe(0);
  });
});

describe("getFacetedMinMaxValues (server facets)", () => {
  it("returns the pair when both bounds are present", () => {
    expect(getFacetedMinMaxValues(facets)(null, "latency")).toEqual([12, 3400]);
  });

  it("collapses to a degenerate range when only one bound is known", () => {
    expect(getFacetedMinMaxValues(facets)(null, "minOnly")).toEqual([5, 5]);
    expect(getFacetedMinMaxValues(facets)(null, "maxOnly")).toEqual([99, 99]);
  });

  it("returns undefined when neither bound is known", () => {
    expect(getFacetedMinMaxValues(facets)(null, "neither")).toBeUndefined();
    expect(getFacetedMinMaxValues(facets)(null, "nope")).toBeUndefined();
    expect(getFacetedMinMaxValues(undefined)(null, "latency")).toBeUndefined();
  });
});

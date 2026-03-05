import type { TableSchemaDefinition } from "@/lib/table-schema";
import { col } from "@/lib/table-schema/col";
import { describe, expect, it } from "vitest";
import {
  filterGenericData,
  getGenericFacets,
  sortGenericData,
  splitGenericData,
} from "./helpers";

// ── Shared test data ─────────────────────────────────────────────────────────

const LEVELS = ["error", "warn", "info", "debug"] as const;
const REGIONS = ["us-east", "us-west", "eu-west"] as const;

/** Schema covering all filter types */
const schema: TableSchemaDefinition = {
  level: col.enum(LEVELS).label("Level").filterable("checkbox"),
  status: col
    .number()
    .label("Status")
    .filterable("checkbox", {
      options: [200, 404, 500].map((c) => ({ label: String(c), value: c })),
    }),
  latency: col
    .number()
    .label("Latency")
    .filterable("slider", { min: 0, max: 5000 }),
  path: col.string().label("Path").filterable("input"),
  date: col.timestamp().label("Date").filterable("timerange"),
  active: col.boolean().label("Active").filterable("checkbox"),
  regions: col.array(col.enum(REGIONS)).label("Regions").filterable("checkbox"),
  host: col.string().label("Host").notFilterable(),
};

const DATA = [
  {
    level: "error",
    status: 500,
    latency: 3000,
    path: "/api/users",
    date: "2024-01-15T10:00:00Z",
    active: true,
    regions: ["us-east", "eu-west"],
    host: "a.com",
  },
  {
    level: "warn",
    status: 404,
    latency: 150,
    path: "/api/orders",
    date: "2024-01-16T12:00:00Z",
    active: false,
    regions: ["us-west"],
    host: "b.com",
  },
  {
    level: "info",
    status: 200,
    latency: 50,
    path: "/api/health",
    date: "2024-01-17T08:00:00Z",
    active: true,
    regions: ["us-east", "us-west"],
    host: "c.com",
  },
  {
    level: "debug",
    status: 200,
    latency: 10,
    path: "/api/debug",
    date: "2024-01-18T15:00:00Z",
    active: false,
    regions: ["eu-west"],
    host: "d.com",
  },
];

// ── filterGenericData ────────────────────────────────────────────────────────

describe("filterGenericData", () => {
  // -- no-op cases --

  it("returns all data when no filters are provided", () => {
    expect(filterGenericData(DATA, {}, schema)).toEqual(DATA);
  });

  it("returns all data when all filter values are empty/null/undefined", () => {
    const filters = { level: [], status: null, latency: undefined, path: "" };
    expect(filterGenericData(DATA, filters, schema)).toEqual(DATA);
  });

  it("ignores filter keys not present in the schema", () => {
    const filters = { unknown_key: ["something"] };
    expect(filterGenericData(DATA, filters, schema)).toEqual(DATA);
  });

  it("ignores filter keys for non-filterable columns", () => {
    const filters = { host: "a.com" };
    expect(filterGenericData(DATA, filters, schema)).toEqual(DATA);
  });

  // -- checkbox (scalar) --

  it("checkbox: filters by single enum value", () => {
    const result = filterGenericData(DATA, { level: ["error"] }, schema);
    expect(result).toHaveLength(1);
    expect(result[0].level).toBe("error");
  });

  it("checkbox: filters by multiple enum values (OR within column)", () => {
    const result = filterGenericData(
      DATA,
      { level: ["error", "warn"] },
      schema,
    );
    expect(result).toHaveLength(2);
  });

  it("checkbox: matches numbers via string coercion", () => {
    // Status 200 stored as number, filter value might be "200" from URL params
    const result = filterGenericData(DATA, { status: ["200"] }, schema);
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.status === 200)).toBe(true);
  });

  it("checkbox: matches boolean values via string coercion", () => {
    const result = filterGenericData(DATA, { active: ["true"] }, schema);
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.active === true)).toBe(true);
  });

  it("checkbox: filters by typed boolean values", () => {
    const result = filterGenericData(DATA, { active: [false] }, schema);
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.active === false)).toBe(true);
  });

  // -- checkbox (array column) --

  it("checkbox: matches when array column intersects filter values", () => {
    const result = filterGenericData(DATA, { regions: ["eu-west"] }, schema);
    expect(result).toHaveLength(2); // rows 0 and 3
  });

  it("checkbox: excludes rows where array column has no intersection", () => {
    const result = filterGenericData(DATA, { regions: ["eu-west"] }, schema);
    expect(
      result.every((r) => (r.regions as string[]).includes("eu-west")),
    ).toBe(true);
  });

  // -- slider --

  it("slider: filters by range [min, max]", () => {
    const result = filterGenericData(DATA, { latency: [0, 100] }, schema);
    expect(result).toHaveLength(2); // latency 50 and 10
    expect(result.every((r) => (r.latency as number) <= 100)).toBe(true);
  });

  it("slider: inclusive bounds (includes min and max exactly)", () => {
    const result = filterGenericData(DATA, { latency: [50, 150] }, schema);
    expect(result).toHaveLength(2); // exactly 50 and 150
  });

  it("slider: excludes NaN values", () => {
    const dataWithNaN = [...DATA, { ...DATA[0], latency: "not-a-number" }];
    const result = filterGenericData(
      dataWithNaN,
      { latency: [0, 5000] },
      schema,
    );
    expect(result).toHaveLength(4); // original 4 pass, NaN excluded
  });

  it("slider: skips when filterValue is not a 2-element array", () => {
    const result = filterGenericData(DATA, { latency: [100] }, schema);
    expect(result).toEqual(DATA); // filter skipped
  });

  // -- input --

  it("input: substring match (case-insensitive)", () => {
    const result = filterGenericData(DATA, { path: "users" }, schema);
    expect(result).toHaveLength(1);
    expect(result[0].path).toBe("/api/users");
  });

  it("input: case-insensitive matching", () => {
    const result = filterGenericData(DATA, { path: "HEALTH" }, schema);
    expect(result).toHaveLength(1);
    expect(result[0].path).toBe("/api/health");
  });

  it("input: number exact match", () => {
    const numberInputSchema: TableSchemaDefinition = {
      status: col.number().label("Status").filterable("input"),
    };
    const result = filterGenericData(DATA, { status: 200 }, numberInputSchema);
    expect(result).toHaveLength(2);
  });

  it("input: handles null cell values gracefully", () => {
    const dataWithNull = [{ ...DATA[0], path: null }];
    const result = filterGenericData(dataWithNull, { path: "api" }, schema);
    expect(result).toHaveLength(0);
  });

  // -- timerange --

  it("timerange: filters by date range [start, end]", () => {
    const start = new Date("2024-01-15T00:00:00Z");
    const end = new Date("2024-01-16T23:59:59Z");
    const result = filterGenericData(DATA, { date: [start, end] }, schema);
    expect(result).toHaveLength(2); // Jan 15 and Jan 16
  });

  it("timerange: single date performs same-day check", () => {
    const day = new Date("2024-01-15T00:00:00Z");
    const result = filterGenericData(DATA, { date: [day] }, schema);
    expect(result).toHaveLength(1);
  });

  it("timerange: excludes rows with invalid dates", () => {
    const dataWithBadDate = [{ ...DATA[0], date: "not-a-date" }];
    const start = new Date("2024-01-01T00:00:00Z");
    const end = new Date("2024-12-31T23:59:59Z");
    const result = filterGenericData(
      dataWithBadDate,
      { date: [start, end] },
      schema,
    );
    expect(result).toHaveLength(0);
  });

  it("timerange: accepts string dates in filter values", () => {
    const result = filterGenericData(
      DATA,
      { date: ["2024-01-15T00:00:00Z", "2024-01-17T23:59:59Z"] },
      schema,
    );
    expect(result).toHaveLength(3); // Jan 15, 16, 17
  });

  // -- combined filters (AND across columns) --

  it("applies multiple filters with AND logic", () => {
    const result = filterGenericData(
      DATA,
      { level: ["error", "warn"], latency: [0, 200] },
      schema,
    );
    expect(result).toHaveLength(1); // only warn (latency 150)
    expect(result[0].level).toBe("warn");
  });

  it("returns empty when combined filters eliminate all rows", () => {
    const result = filterGenericData(
      DATA,
      { level: ["error"], status: ["200"] },
      schema,
    );
    expect(result).toHaveLength(0);
  });
});

// ── sortGenericData ──────────────────────────────────────────────────────────

describe("sortGenericData", () => {
  it("returns data unchanged when sort is null", () => {
    expect(sortGenericData(DATA, null)).toEqual(DATA);
  });

  it("sorts numbers ascending", () => {
    const result = sortGenericData(DATA, { id: "latency", desc: false });
    const latencies = result.map((r) => r.latency);
    expect(latencies).toEqual([10, 50, 150, 3000]);
  });

  it("sorts numbers descending", () => {
    const result = sortGenericData(DATA, { id: "latency", desc: true });
    const latencies = result.map((r) => r.latency);
    expect(latencies).toEqual([3000, 150, 50, 10]);
  });

  it("sorts strings ascending", () => {
    const result = sortGenericData(DATA, { id: "level", desc: false });
    const levels = result.map((r) => r.level);
    expect(levels).toEqual(["debug", "error", "info", "warn"]);
  });

  it("sorts strings descending", () => {
    const result = sortGenericData(DATA, { id: "level", desc: true });
    const levels = result.map((r) => r.level);
    expect(levels).toEqual(["warn", "info", "error", "debug"]);
  });

  it("sorts date strings ascending", () => {
    const result = sortGenericData(DATA, { id: "date", desc: false });
    const dates = result.map((r) => r.date);
    expect(dates).toEqual([
      "2024-01-15T10:00:00Z",
      "2024-01-16T12:00:00Z",
      "2024-01-17T08:00:00Z",
      "2024-01-18T15:00:00Z",
    ]);
  });

  it("handles nullish values (pushed to start ascending)", () => {
    const dataWithNull = [
      { latency: null },
      { latency: 100 },
      { latency: undefined },
      { latency: 50 },
    ];
    const result = sortGenericData(dataWithNull as Record<string, unknown>[], {
      id: "latency",
      desc: false,
    });
    // null/undefined sort before real values in ascending
    expect(result.map((r) => r.latency)).toEqual([null, undefined, 50, 100]);
  });

  it("handles nullish values (pushed to end descending)", () => {
    const dataWithNull = [
      { latency: null },
      { latency: 100 },
      { latency: undefined },
      { latency: 50 },
    ];
    const result = sortGenericData(dataWithNull as Record<string, unknown>[], {
      id: "latency",
      desc: true,
    });
    // null/undefined sort after real values in descending
    expect(result.map((r) => r.latency)).toEqual([100, 50, null, undefined]);
  });

  it("does not mutate the original array", () => {
    const original = [...DATA];
    sortGenericData(DATA, { id: "latency", desc: true });
    expect(DATA).toEqual(original);
  });

  it("handles equal values without crashing", () => {
    const sameData = [{ val: 1 }, { val: 1 }, { val: 1 }];
    const result = sortGenericData(sameData, { id: "val", desc: false });
    expect(result).toHaveLength(3);
    expect(result.every((r) => r.val === 1)).toBe(true);
  });
});

// ── getGenericFacets ─────────────────────────────────────────────────────────

describe("getGenericFacets", () => {
  it("computes row counts from filtered data", () => {
    const filtered = DATA.filter((r) => r.level === "error");
    const facets = getGenericFacets(filtered, DATA, schema);
    expect(facets.level.rows).toEqual(
      expect.arrayContaining([{ value: "error", total: 1 }]),
    );
    expect(facets.level.total).toBe(1);
  });

  it("computes min/max from full dataset (not filtered)", () => {
    const filtered = DATA.filter((r) => (r.latency as number) < 200);
    const facets = getGenericFacets(filtered, DATA, schema);
    // min/max should still be from full DATA (10..3000)
    expect(facets.latency.min).toBe(10);
    expect(facets.latency.max).toBe(3000);
  });

  it("preserves boolean types in facet rows", () => {
    const facets = getGenericFacets(DATA, DATA, schema);
    const activeValues = facets.active.rows.map((r) => r.value);
    expect(activeValues).toContain(true);
    expect(activeValues).toContain(false);
    // Should not contain "true" or "false" as strings
    expect(activeValues).not.toContain("true");
    expect(activeValues).not.toContain("false");
  });

  it("coerces numeric string values to numbers", () => {
    const facets = getGenericFacets(DATA, DATA, schema);
    const statusValues = facets.status.rows.map((r) => r.value);
    expect(statusValues).toContain(200);
    expect(statusValues).toContain(404);
    expect(statusValues).toContain(500);
    // Should be numbers, not strings
    expect(statusValues).not.toContain("200");
  });

  it("counts each element of array columns separately", () => {
    const facets = getGenericFacets(DATA, DATA, schema);
    // "us-east" appears in rows 0 and 2
    const usEastRow = facets.regions.rows.find((r) => r.value === "us-east");
    expect(usEastRow?.total).toBe(2);
    // "eu-west" appears in rows 0 and 3
    const euWestRow = facets.regions.rows.find((r) => r.value === "eu-west");
    expect(euWestRow?.total).toBe(2);
  });

  it("returns empty facets for empty filtered data", () => {
    const facets = getGenericFacets([], DATA, schema);
    // No rows counted → no entries in facets
    expect(Object.keys(facets)).toHaveLength(0);
  });

  it("excludes non-filterable columns", () => {
    const facets = getGenericFacets(DATA, DATA, schema);
    expect(facets.host).toBeUndefined();
  });

  it("skips null/undefined values in rows", () => {
    const dataWithNull = [
      {
        level: null,
        status: 200,
        latency: 50,
        path: "/test",
        date: "2024-01-15T10:00:00Z",
        active: true,
        regions: ["us-east"],
        host: "x.com",
      },
    ];
    const facets = getGenericFacets(dataWithNull, dataWithNull, schema);
    // level is null, so no facet row for level
    expect(facets.level).toBeUndefined();
  });

  it("computes total as sum of all row counts", () => {
    const facets = getGenericFacets(DATA, DATA, schema);
    expect(facets.level.total).toBe(4); // 4 rows, each with 1 level
  });

  it("handles min/max when all values are the same", () => {
    const sameData = [{ latency: 100 }, { latency: 100 }] as Record<
      string,
      unknown
    >[];
    const numSchema: TableSchemaDefinition = {
      latency: col
        .number()
        .label("Latency")
        .filterable("slider", { min: 0, max: 5000 }),
    };
    const facets = getGenericFacets(sameData, sameData, numSchema);
    expect(facets.latency.min).toBe(100);
    expect(facets.latency.max).toBe(100);
  });

  it("does not compute min/max for non-numeric columns", () => {
    const facets = getGenericFacets(DATA, DATA, schema);
    // level is a string enum, min/max won't be set (NaN from Number("error"))
    expect(facets.level.min).toBeUndefined();
    expect(facets.level.max).toBeUndefined();
  });
});

// ── splitGenericData ─────────────────────────────────────────────────────────

describe("splitGenericData", () => {
  it("returns the first page", () => {
    const result = splitGenericData(DATA, 0, 2);
    expect(result).toHaveLength(2);
    expect(result).toEqual(DATA.slice(0, 2));
  });

  it("returns a middle page", () => {
    const result = splitGenericData(DATA, 1, 2);
    expect(result).toEqual(DATA.slice(1, 3));
  });

  it("returns remaining items when size exceeds data length", () => {
    const result = splitGenericData(DATA, 2, 100);
    expect(result).toEqual(DATA.slice(2));
  });

  it("returns empty array when offset is beyond data length", () => {
    const result = splitGenericData(DATA, 100, 10);
    expect(result).toEqual([]);
  });

  it("returns empty array for empty data", () => {
    const result = splitGenericData([], 0, 10);
    expect(result).toEqual([]);
  });
});

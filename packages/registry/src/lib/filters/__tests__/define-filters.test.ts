import { describe, expect, it } from "vitest";
import { col, createTableSchema } from "../../table-schema";
import type {
  SchemaJSON,
  TableSchemaDefinition,
} from "../../table-schema/types";
import { defineFilters } from "../index";
import type { FilterSpec } from "../types";

const LEVELS = ["error", "warn", "info"] as const;
const REGIONS = ["ams", "fra", "iad"] as const;

/**
 * One table exercising every (FilterType, ColKind) pair the builder can
 * produce, plus two non-filterable columns.
 */
const definition = {
  host: col.string().label("Host").filterable("input"),
  latency: col
    .number()
    .label("Latency")
    .filterable("slider", { min: 0, max: 5000 }),
  // The RFC's load-bearing column: a numeric checkbox.
  status: col
    .number()
    .label("Status")
    .filterable("checkbox", {
      options: [
        { label: "200", value: 200 },
        { label: "404", value: 404 },
        { label: "500", value: 500 },
      ],
    }),
  level: col.enum(LEVELS).label("Level"),
  regions: col
    .array(col.enum(REGIONS))
    .label("Regions")
    .filterable("checkbox", {
      options: REGIONS.map((r) => ({ label: r, value: r })),
    }),
  date: col.timestamp().label("Date").filterable("timerange"),
  active: col.boolean().label("Active"),
  headers: col.record().label("Headers"),
  requestId: col.string().label("Request ID").notFilterable(),
} satisfies TableSchemaDefinition;

const schema = createTableSchema(definition);
const json: SchemaJSON = schema.toJSON();

const fromDefinition = defineFilters(definition);
const fromJSON = defineFilters(json);

const day = (d: number, h = 0) => new Date(2024, 0, d, h);

type Row = {
  host: string;
  latency: number;
  status: number;
  level: string;
  regions: string[];
  date: Date;
  active: boolean;
};

// The RFC's seed distribution: 200, 201, 301, 500, 404, 200, 429, 200.
const STATUSES = [200, 201, 301, 500, 404, 200, 429, 200];
const rows: Row[] = STATUSES.map((status, i) => ({
  host: i % 2 === 0 ? "api.cloudflare.com" : "edge.vercel.app",
  latency: 100 * (i + 1),
  status,
  level: LEVELS[i % LEVELS.length]!,
  regions: [REGIONS[i % REGIONS.length]!, "gru"],
  date: day(i + 1, 12),
  active: i % 2 === 0,
}));

// ── The three sources ───────────────────────────────────────────────────────

describe("defineFilters — sources", () => {
  it("derives specs from a TableSchemaDefinition", () => {
    expect(fromDefinition.specs).toEqual([
      { key: "host", type: "input", kind: "string" },
      { key: "latency", type: "slider", kind: "number", min: 0, max: 5000 },
      {
        key: "status",
        type: "checkbox",
        kind: "number",
        options: [200, 404, 500],
      },
      {
        key: "level",
        type: "checkbox",
        kind: "enum",
        options: ["error", "warn", "info"],
      },
      {
        key: "regions",
        type: "checkbox",
        kind: "array",
        itemKind: "enum",
        options: ["ams", "fra", "iad"],
      },
      { key: "date", type: "timerange", kind: "timestamp" },
      {
        key: "active",
        type: "checkbox",
        kind: "boolean",
        options: [true, false],
      },
    ]);
  });

  it("produces IDENTICAL specs from the definition and from its toJSON()", () => {
    // This is the property that lets the declaration cross the `"use client"`
    // boundary as data: `table-schema.tsx` cannot be imported server-side, but
    // its JSON can, and both must mean exactly the same thing.
    expect(fromJSON.specs).toEqual(fromDefinition.specs);
  });

  it("survives a real JSON.stringify / JSON.parse round trip", () => {
    const wire = JSON.parse(JSON.stringify(schema)) as SchemaJSON;
    expect(defineFilters(wire).specs).toEqual(fromDefinition.specs);
  });

  it("accepts a readonly FilterSpec[] verbatim", () => {
    const specs: readonly FilterSpec[] = [
      { key: "status", type: "checkbox", kind: "number" },
      { key: "latency", type: "slider", kind: "number", min: 0, max: 100 },
    ];
    const filters = defineFilters(specs);
    expect(filters.specs).toEqual(specs);
  });

  it("copies the spec array rather than aliasing the caller's", () => {
    const specs: FilterSpec[] = [
      { key: "status", type: "checkbox", kind: "number" },
    ];
    const filters = defineFilters(specs);
    expect(filters.specs).not.toBe(specs);
    specs.push({ key: "host", type: "input", kind: "string" });
    expect(filters.specs).toHaveLength(1);
  });

  it("omits non-filterable columns from every source", () => {
    const keys = fromDefinition.specs.map((s) => s.key);
    expect(keys).not.toContain("headers");
    expect(keys).not.toContain("requestId");
    expect(fromJSON.specs.map((s) => s.key)).toEqual(keys);
  });

  it("preserves the declaration order of the definition", () => {
    expect(fromDefinition.specs.map((s) => s.key)).toEqual([
      "host",
      "latency",
      "status",
      "level",
      "regions",
      "date",
      "active",
    ]);
  });
});

describe("defineFilters — spec(key)", () => {
  it("looks up a declared column", () => {
    expect(fromDefinition.spec("status")).toEqual({
      key: "status",
      type: "checkbox",
      kind: "number",
      options: [200, 404, 500],
    });
  });

  it("returns undefined for an unknown or non-filterable column", () => {
    expect(fromDefinition.spec("nope")).toBeUndefined();
    expect(fromDefinition.spec("headers")).toBeUndefined();
    expect(fromDefinition.spec("requestId")).toBeUndefined();
  });
});

// ── plan ────────────────────────────────────────────────────────────────────

describe("plan", () => {
  it("compiles the load-bearing numeric checkbox to oneOf", () => {
    expect(fromDefinition.plan({ status: [200, 500] })).toEqual([
      { op: "oneOf", key: "status", values: [200, 500] },
    ]);
  });

  it("drops unknown keys", () => {
    expect(fromDefinition.plan({ nope: "x", alsoNope: [1, 2] })).toEqual([]);
  });

  it("drops non-filterable declared keys", () => {
    expect(
      fromDefinition.plan({ headers: { a: "b" }, requestId: "abc" }),
    ).toEqual([]);
  });

  it("drops inactive values", () => {
    expect(
      fromDefinition.plan({
        host: "",
        status: [],
        latency: null,
        date: undefined,
        level: [null],
      }),
    ).toEqual([]);
  });

  it("keeps active values alongside inactive ones", () => {
    expect(fromDefinition.plan({ host: "", status: [200], nope: "x" })).toEqual(
      [{ op: "oneOf", key: "status", values: [200] }],
    );
  });

  it("emits one op per active key", () => {
    const ops = fromDefinition.plan({
      host: "cloud",
      status: [200, 500],
      latency: [100, 500],
    });
    expect(ops.map((o) => o.op).sort()).toEqual([
      "numberRange",
      "oneOf",
      "substring",
    ]);
  });

  it("the same plan comes out of the JSON-sourced Filters", () => {
    const values = { host: "cloud", status: [200, 500], latency: [100, 500] };
    expect(fromJSON.plan(values)).toEqual(fromDefinition.plan(values));
  });
});

describe("plan — selection", () => {
  const values = { host: "cloud", status: [200], latency: [100, 500] };

  it("`only` restricts to the named keys", () => {
    expect(
      fromDefinition.plan(values, { only: ["status"] }).map((o) => o.key),
    ).toEqual(["status"]);
  });

  it("`only` with several keys keeps all of them", () => {
    expect(
      fromDefinition
        .plan(values, { only: ["status", "latency"] })
        .map((o) => o.key)
        .sort(),
    ).toEqual(["latency", "status"]);
  });

  it("`only` naming an unknown key yields nothing", () => {
    expect(fromDefinition.plan(values, { only: ["nope"] })).toEqual([]);
  });

  it("`exclude` removes the named keys", () => {
    expect(
      fromDefinition
        .plan(values, { exclude: ["status"] })
        .map((o) => o.key)
        .sort(),
    ).toEqual(["host", "latency"]);
  });

  it("`exclude` WINS over `only` when both name the same key", () => {
    // `isSelected` checks `exclude` first and returns early, so a key in both
    // lists is dropped. Pinned as the source's actual precedence.
    expect(
      fromDefinition.plan(values, { only: ["status"], exclude: ["status"] }),
    ).toEqual([]);
  });

  it("`only` and `exclude` compose when they name different keys", () => {
    expect(
      fromDefinition
        .plan(values, { only: ["status", "latency"], exclude: ["latency"] })
        .map((o) => o.key),
    ).toEqual(["status"]);
  });

  it("an empty selection object restricts nothing", () => {
    expect(fromDefinition.plan(values, {})).toHaveLength(3);
  });

  it("an empty `only` array excludes everything", () => {
    expect(fromDefinition.plan(values, { only: [] })).toEqual([]);
  });
});

// ── matches / apply ─────────────────────────────────────────────────────────

describe("matches", () => {
  const row = rows[0]!; // status 200, host api.cloudflare.com, latency 100

  it("is true with no active filters", () => {
    expect(fromDefinition.matches({}, row)).toBe(true);
    expect(fromDefinition.matches({ host: "" }, row)).toBe(true);
  });

  it("ANDs multiple active filters", () => {
    expect(
      fromDefinition.matches({ status: [200], host: "cloudflare" }, row),
    ).toBe(true);
    // One conjunct fails ⇒ the whole predicate fails.
    expect(fromDefinition.matches({ status: [200], host: "vercel" }, row)).toBe(
      false,
    );
    expect(
      fromDefinition.matches({ status: [404], host: "cloudflare" }, row),
    ).toBe(false);
  });

  it("ANDs across all four filter types at once", () => {
    expect(
      fromDefinition.matches(
        {
          host: "CLOUDFLARE",
          status: [200, 500],
          latency: [0, 5000],
          regions: ["ams"],
          date: [day(1), day(2)],
          level: ["error"],
        },
        row,
      ),
    ).toBe(true);
  });

  it("honours a selection", () => {
    expect(
      fromDefinition.matches({ status: [404] }, row, { exclude: ["status"] }),
    ).toBe(true);
  });

  it("reads dotted keys off nested rows", () => {
    const filters = defineFilters([
      { key: "timing.dns", type: "slider", kind: "number" },
    ]);
    expect(
      filters.matches({ "timing.dns": [0, 20] }, { timing: { dns: 12 } }),
    ).toBe(true);
    expect(
      filters.matches({ "timing.dns": [0, 20] }, { "timing.dns": 12 }),
    ).toBe(true);
    expect(
      filters.matches({ "timing.dns": [0, 5] }, { timing: { dns: 12 } }),
    ).toBe(false);
  });
});

describe("apply", () => {
  it("selecting 200 and 500 returns exactly the 200s and 500s", () => {
    // The regression: `BETWEEN 200 AND 500` returned all 8 rows.
    const result = fromDefinition.apply(rows, { status: [200, 500] });
    expect(result.map((r) => r.status)).toEqual([200, 500, 200, 200]);
    expect(result).toHaveLength(4);
  });

  it("a 200-only selection returns 3 rows", () => {
    expect(fromDefinition.apply(rows, { status: [200] })).toHaveLength(3);
  });

  it("ANDs across filters", () => {
    // Indices 0, 3, 5, 7 are the 200s and 500s; hosts alternate, so index 0 is
    // on cloudflare and 3, 5, 7 are on vercel. Latency is 100 * (index + 1).
    expect(
      fromDefinition
        .apply(rows, { status: [200, 500], host: "cloudflare" })
        .map((r) => r.latency),
    ).toEqual([100]);
    expect(
      fromDefinition
        .apply(rows, { status: [200, 500], host: "vercel" })
        .map((r) => r.latency),
    ).toEqual([400, 600, 800]);
    // Each conjunct on its own is strictly weaker than the conjunction.
    expect(fromDefinition.apply(rows, { status: [200, 500] })).toHaveLength(4);
    expect(fromDefinition.apply(rows, { host: "vercel" })).toHaveLength(4);
  });

  it("matches a non-first array element on an array column", () => {
    // Every row's regions are [<rotating>, "gru"], so "gru" is never first.
    expect(fromDefinition.apply(rows, { regions: ["gru"] })).toHaveLength(
      rows.length,
    );
  });

  it("is case-insensitive on an input column", () => {
    expect(fromDefinition.apply(rows, { host: "CLOUDFLARE" })).toHaveLength(4);
  });

  it("returns everything when no filter is active", () => {
    expect(fromDefinition.apply(rows, {})).toHaveLength(rows.length);
    expect(fromDefinition.apply(rows, { host: "", status: [] })).toHaveLength(
      rows.length,
    );
  });

  it("returns a new array, never the caller's", () => {
    expect(fromDefinition.apply(rows, {})).not.toBe(rows);
    expect(fromDefinition.apply(rows, { status: [200] })).not.toBe(rows);
  });

  it("honours a selection", () => {
    expect(
      fromDefinition.apply(rows, { status: [200] }, { exclude: ["status"] }),
    ).toHaveLength(rows.length);
    expect(
      fromDefinition.apply(
        rows,
        { status: [200], host: "vercel" },
        {
          only: ["host"],
        },
      ),
    ).toHaveLength(4);
  });

  it("filters a timerange inclusively on both ends", () => {
    const result = fromDefinition.apply(rows, { date: [day(1), day(3, 12)] });
    expect(result).toHaveLength(3);
  });

  it("the JSON-sourced Filters filters identically", () => {
    const values = { status: [200, 500], host: "cloudflare" };
    expect(fromJSON.apply(rows, values)).toEqual(
      fromDefinition.apply(rows, values),
    );
  });
});

// ── filterFn ────────────────────────────────────────────────────────────────

describe("filterFn", () => {
  const tanstackRow = (row: Record<string, unknown>) => ({
    getValue: (id: string) => row[id],
  });

  it("returns undefined for a non-filterable key", () => {
    expect(fromDefinition.filterFn("headers")).toBeUndefined();
    expect(fromDefinition.filterFn("requestId")).toBeUndefined();
    expect(fromDefinition.filterFn("nope")).toBeUndefined();
  });

  it("returns a function for a filterable key", () => {
    expect(typeof fromDefinition.filterFn("status")).toBe("function");
  });

  it("returns TRUE for an inactive filter value (TanStack semantics)", () => {
    // TanStack keeps a column filter registered while its value is empty; a
    // filter that matches nothing would blank the table.
    const fn = fromDefinition.filterFn("status")!;
    const row = tanstackRow({ status: 404 });
    expect(fn(row, "status", [])).toBe(true);
    expect(fn(row, "status", null)).toBe(true);
    expect(fn(row, "status", undefined)).toBe(true);
    expect(
      fromDefinition.filterFn("host")!(tanstackRow({ host: "a" }), "host", ""),
    ).toBe(true);
  });

  it("evaluates an active filter against the row's value", () => {
    const fn = fromDefinition.filterFn("status")!;
    expect(fn(tanstackRow({ status: 200 }), "status", [200, 500])).toBe(true);
    expect(fn(tanstackRow({ status: 404 }), "status", [200, 500])).toBe(false);
    // The regression, at the TanStack boundary.
    expect(fn(tanstackRow({ status: 301 }), "status", [200, 500])).toBe(false);
  });

  it("uses the columnId it is handed, not the spec key", () => {
    const fn = fromDefinition.filterFn("status")!;
    expect(fn(tanstackRow({ other: 200 }), "other", [200])).toBe(true);
  });

  it("applies array-column overlap semantics", () => {
    const fn = fromDefinition.filterFn("regions")!;
    expect(
      fn(tanstackRow({ regions: ["ams", "iad"] }), "regions", ["iad"]),
    ).toBe(true);
    expect(
      fn(tanstackRow({ regions: ["ams", "iad"] }), "regions", ["gru"]),
    ).toBe(false);
  });

  it("applies timerange semantics", () => {
    const fn = fromDefinition.filterFn("date")!;
    expect(fn(tanstackRow({ date: day(5, 6) }), "date", [day(5), day(6)])).toBe(
      true,
    );
    expect(fn(tanstackRow({ date: day(9, 6) }), "date", [day(5), day(6)])).toBe(
      false,
    );
  });
});

// ── coerce ──────────────────────────────────────────────────────────────────

describe("coerce", () => {
  it("drops unknown keys", () => {
    expect(fromDefinition.coerce({ nope: "x", status: [200] })).toEqual({
      status: [200],
    });
  });

  it("drops non-filterable declared keys", () => {
    expect(
      fromDefinition.coerce({ headers: { a: "b" }, requestId: "id" }),
    ).toEqual({});
  });

  it("drops inactive values", () => {
    expect(
      fromDefinition.coerce({
        host: "",
        status: [],
        latency: null,
        date: undefined,
      }),
    ).toEqual({});
  });

  it("drops values outside a declared enum option set", () => {
    // The LLM invents a level that does not exist.
    expect(fromDefinition.coerce({ level: ["error", "catastrophe"] })).toEqual({
      level: ["error"],
    });
  });

  it("drops the key entirely when no value survives the option set", () => {
    expect(fromDefinition.coerce({ level: ["catastrophe"] })).toEqual({});
    expect(fromDefinition.coerce({ status: [418] })).toEqual({});
  });

  it("normalizes URL strings to the declared kind", () => {
    // Option matching is still cross-type, so `"200"` is recognised against the
    // numeric option `200` — but what comes back is the declared type, so the
    // SQL backend gets `inArray(integerColumn, [200, 500])`.
    expect(fromDefinition.coerce({ status: ["200", "500"] })).toEqual({
      status: [200, 500],
    });
  });

  it("filters an array column's options too", () => {
    expect(fromDefinition.coerce({ regions: ["fra", "atlantis"] })).toEqual({
      regions: ["fra"],
    });
  });

  it("coerces ISO strings to Dates for a timerange", () => {
    const result = fromDefinition.coerce({
      date: ["2024-01-15T08:00:00.000Z", "2024-01-20T08:00:00.000Z"],
    });
    const range = result.date as [Date, Date];
    expect(range).toHaveLength(2);
    expect(range[0]).toBeInstanceOf(Date);
    expect(range[1]).toBeInstanceOf(Date);
    expect(range[0].toISOString()).toBe("2024-01-15T08:00:00.000Z");
    expect(range[1].toISOString()).toBe("2024-01-20T08:00:00.000Z");
  });

  it("expands a single timerange date into a whole-day [from, to]", () => {
    const result = fromDefinition.coerce({
      date: ["2024-01-15T08:00:00.000Z"],
    });
    const range = result.date as [Date, Date];
    expect(range[0].getHours()).toBe(0);
    expect(range[1].getHours()).toBe(23);
  });

  it("swaps a reversed timerange", () => {
    const result = fromDefinition.coerce({
      date: ["2024-01-20T08:00:00.000Z", "2024-01-15T08:00:00.000Z"],
    });
    const range = result.date as [Date, Date];
    expect(range[0].getTime()).toBeLessThan(range[1].getTime());
  });

  it("returns [min, max] for a slider", () => {
    expect(fromDefinition.coerce({ latency: [100, 500] })).toEqual({
      latency: [100, 500],
    });
  });

  it("returns [min, max] for a one-handle slider", () => {
    expect(fromDefinition.coerce({ latency: 500 })).toEqual({
      latency: [500, 500],
    });
  });

  it("swaps and string-coerces slider bounds", () => {
    expect(fromDefinition.coerce({ latency: ["500", "100"] })).toEqual({
      latency: [100, 500],
    });
  });

  it("returns a number for an input on a number column", () => {
    const filters = defineFilters([
      { key: "n", type: "input", kind: "number" },
    ]);
    expect(filters.coerce({ n: "200" })).toEqual({ n: 200 });
    expect(filters.coerce({ n: "abc" })).toEqual({});
  });

  it("returns a string for an input on a string column", () => {
    expect(fromDefinition.coerce({ host: "Cloudflare" })).toEqual({
      host: "Cloudflare",
    });
  });

  it("keeps a checkbox without a declared option set unfiltered", () => {
    const filters = defineFilters([
      { key: "status", type: "checkbox", kind: "number" },
    ]);
    expect(filters.coerce({ status: [200, 418] })).toEqual({
      status: [200, 418],
    });
  });

  it("output is a valid input to plan()", () => {
    const raw = {
      status: ["200", "500"],
      date: ["2024-01-15T08:00:00.000Z", "2024-01-20T08:00:00.000Z"],
      latency: ["100", "500"],
      level: ["error", "catastrophe"],
      nope: "x",
    };
    const coerced = fromDefinition.coerce(raw);
    expect(
      fromDefinition
        .plan(coerced)
        .map((o) => o.op)
        .sort(),
    ).toEqual(["dateRange", "numberRange", "oneOf", "oneOf"]);
  });

  it("is idempotent", () => {
    const once = fromDefinition.coerce({
      status: [200, 418],
      latency: ["100", "500"],
      host: "api",
    });
    expect(fromDefinition.coerce(once)).toEqual(once);
  });

  it("the JSON-sourced Filters coerces identically", () => {
    const raw = { status: ["200", "418"], level: ["error", "nope"], nope: 1 };
    expect(fromJSON.coerce(raw)).toEqual(fromDefinition.coerce(raw));
  });
});

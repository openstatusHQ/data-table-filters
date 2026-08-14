import { describe, expect, it } from "vitest";
import { inferSchemaFromJSON } from "./infer";
import type { ColumnDescriptor } from "./types";

// The heuristics in `infer.ts` are driven by private word lists (ID_WORDS,
// CODE_WORDS, EMAIL_WORDS, …). These tests pin the *intent* of each rule family
// with one representative key per family plus the negative cases. They do not
// enumerate the word lists — adding a synonym is not a behaviour change, and a
// test that fails when one is added is testing the implementation, not the user.

/** Narrow to an array column and return its item descriptor. */
function arrayItemOf(column: ColumnDescriptor): ColumnDescriptor {
  if (column.kind !== "array") {
    throw new Error(`expected an array column, got "${column.kind}"`);
  }
  return column.arrayItem;
}

/** Narrow to an enum column and return its values. */
function enumValuesOf(column: ColumnDescriptor): readonly string[] {
  if (column.kind !== "enum") {
    throw new Error(`expected an enum column, got "${column.kind}"`);
  }
  return column.enumValues;
}

// ── envelope ─────────────────────────────────────────────────────────────────

describe("inferSchemaFromJSON — envelope", () => {
  it("returns a versioned envelope", () => {
    const schema = inferSchemaFromJSON([{ host: "localhost" }]);
    expect(schema.version).toBe(1);
  });

  it("returns a versioned empty envelope for an empty array", () => {
    expect(inferSchemaFromJSON([])).toEqual({ version: 1, columns: [] });
  });

  it("returns a versioned empty envelope for a non-array input", () => {
    expect(inferSchemaFromJSON("not an array" as unknown as unknown[])).toEqual(
      { version: 1, columns: [] },
    );
  });
});

// ── provenance ───────────────────────────────────────────────────────────────

describe("inferSchemaFromJSON — provenance", () => {
  it("marks every column as inferred with a non-empty rule", () => {
    const data = [
      {
        host: "alpha",
        latency: 100,
        active: true,
        createdAt: "2024-01-01T00:00:00Z",
        tags: ["a", "b"],
        headers: { "content-type": "application/json" },
        level: "error",
      },
      {
        host: "beta",
        latency: 200,
        active: false,
        createdAt: "2024-01-02",
        tags: ["c"],
        headers: {},
        level: "warn",
      },
    ];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns).toHaveLength(7);
    for (const column of columns) {
      expect(column.provenance.source).toBe("inferred");
      // The rule name is what `schemaToTypeScript` reads to pick a factory.
      expect(
        column.provenance.source === "inferred" && column.provenance.rule,
      ).toBeTruthy();
    }
  });

  it("records the rule that fired", () => {
    const { columns } = inferSchemaFromJSON([
      { createdAt: "2024-01-01T00:00:00Z" },
    ]);
    expect(columns[0]?.provenance).toEqual({
      source: "inferred",
      rule: "iso8601-string",
    });
  });
});

// ── edge cases ───────────────────────────────────────────────────────────────

describe("inferSchemaFromJSON — edge cases", () => {
  it("skips non-object rows (null, primitives) and processes valid rows", () => {
    const data = [null, undefined, "string", { host: "localhost" }];
    const { columns } = inferSchemaFromJSON(data as unknown[]);
    expect(columns).toHaveLength(1);
    expect(columns[0]?.key).toBe("host");
  });

  it("falls back to string/input for all-null values", () => {
    const data = [{ metadata: null }, { metadata: null }];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.kind).toBe("string");
    expect(columns[0]?.filter?.type).toBe("input");
  });

  it("preserves column insertion order from the first row", () => {
    const data = [{ z: "z-val", a: "a-val", m: "m-val" }];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns.map((c) => c.key)).toEqual(["z", "a", "m"]);
  });
});

// ── label derivation ─────────────────────────────────────────────────────────

describe("inferSchemaFromJSON — label derivation", () => {
  it("converts camelCase keys to Title Case labels", () => {
    const data = [{ hostName: "localhost" }, { hostName: "server1" }];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.label).toBe("Host Name");
  });

  it("converts snake_case keys to title-cased space-separated labels", () => {
    const data = [{ created_at: "2024-01-01T00:00:00Z" }];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.label).toBe("Created At");
  });

  it("converts kebab-case keys to space-separated labels", () => {
    const data = [{ "content-type": "application/json" }];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.label).toBe("Content Type");
  });

  it("capitalises single-word keys", () => {
    const data = [{ level: "error" }];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.label).toBe("Level");
  });
});

// ── string / enum inference ──────────────────────────────────────────────────

describe("inferSchemaFromJSON — string inference", () => {
  it("infers 'string' with 'input' filter when there are more than 10 distinct values", () => {
    const data = Array.from({ length: 15 }, (_, i) => ({
      message: `msg-${i}`,
    }));
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.kind).toBe("string");
    expect(columns[0]?.filter?.type).toBe("input");
  });

  it("infers 'enum' with 'checkbox' filter when there are ≤ 10 distinct string values", () => {
    const data = [
      { level: "error" },
      { level: "warn" },
      { level: "info" },
      { level: "error" },
    ];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.kind).toBe("enum");
    expect(columns[0]?.filter?.type).toBe("checkbox");
    expect(enumValuesOf(columns[0]!)).toEqual(["error", "warn", "info"]);
  });

  it("auto-derives checkbox options from the distinct enum values", () => {
    const data = [{ level: "error" }, { level: "warn" }, { level: "info" }];
    const { columns } = inferSchemaFromJSON(data);
    const options = columns[0]?.filter?.options ?? [];
    expect(options).toHaveLength(3);
    expect(options.map((o) => o.value).sort()).toEqual([
      "error",
      "info",
      "warn",
    ]);
  });
});

// ── boolean inference ────────────────────────────────────────────────────────

describe("inferSchemaFromJSON — boolean inference", () => {
  it("infers 'boolean' with 'checkbox' filter for true/false values", () => {
    const data = [{ active: true }, { active: false }, { active: true }];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.kind).toBe("boolean");
    expect(columns[0]?.filter?.type).toBe("checkbox");
  });
});

// ── number inference ─────────────────────────────────────────────────────────

describe("inferSchemaFromJSON — number inference", () => {
  it("infers 'number' with 'slider' filter and correct bounds when min ≠ max", () => {
    const data = [{ latency: 100 }, { latency: 200 }, { latency: 300 }];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.kind).toBe("number");
    expect(columns[0]?.filter).toMatchObject({
      type: "slider",
      min: 100,
      max: 300,
    });
  });

  it("infers 'number' with 'input' filter when all values are equal", () => {
    const data = [{ port: 443 }, { port: 443 }, { port: 443 }];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.kind).toBe("number");
    expect(columns[0]?.filter?.type).toBe("input");
  });

  it("does not treat small numbers as timestamps", () => {
    const data = [{ count: 42 }, { count: 100 }];
    const { columns } = inferSchemaFromJSON(data);
    // 42 and 100 are below the Unix-ms threshold → number, not timestamp
    expect(columns[0]?.kind).toBe("number");
    expect(columns[0]?.filter?.type).toBe("slider");
  });
});

// ── timestamp inference ──────────────────────────────────────────────────────

describe("inferSchemaFromJSON — timestamp inference", () => {
  it("infers 'timestamp' from ISO 8601 strings", () => {
    const data = [
      { createdAt: "2024-01-01T00:00:00Z" },
      { createdAt: "2024-06-15T12:30:00Z" },
    ];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.kind).toBe("timestamp");
    expect(columns[0]?.filter?.type).toBe("timerange");
  });

  it("infers 'timestamp' from ISO 8601 date-only strings", () => {
    const data = [{ date: "2024-01-01" }, { date: "2024-06-15" }];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.kind).toBe("timestamp");
    expect(columns[0]?.filter?.type).toBe("timerange");
  });

  it("infers 'timestamp' from Unix millisecond numbers (13-digit range)", () => {
    const data = [
      { ts: 1704067200000 }, // 2024-01-01
      { ts: 1717416600000 }, // 2024-06-03
    ];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.kind).toBe("timestamp");
    expect(columns[0]?.filter?.type).toBe("timerange");
  });
});

// ── array inference ──────────────────────────────────────────────────────────

describe("inferSchemaFromJSON — array inference", () => {
  it("infers 'array' of enum with 'checkbox' when items are strings with ≤ 10 distinct values", () => {
    const data = [{ tags: ["foo", "bar"] }, { tags: ["foo", "baz"] }];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.kind).toBe("array");
    expect(columns[0]?.filter?.type).toBe("checkbox");
    const item = arrayItemOf(columns[0]!);
    expect(item.kind).toBe("enum");
    expect(enumValuesOf(item)).toEqual(
      expect.arrayContaining(["foo", "bar", "baz"]),
    );
  });

  it("auto-derives checkbox options from the distinct array item values", () => {
    const data = [{ tags: ["foo", "bar"] }, { tags: ["baz"] }];
    const { columns } = inferSchemaFromJSON(data);
    const options = columns[0]?.filter?.options ?? [];
    expect(options.map((o) => o.value).sort()).toEqual(["bar", "baz", "foo"]);
  });

  it("infers a non-filterable number array when items are numbers", () => {
    const data = [{ ids: [1, 2, 3] }, { ids: [4, 5] }];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.kind).toBe("array");
    expect(arrayItemOf(columns[0]!).kind).toBe("number");
    expect(columns[0]?.filter).toBeNull();
  });

  it("keeps a high-cardinality string[] column an array of strings", () => {
    // Regression: a `string[]` column whose items exceed the enum threshold used
    // to degrade to `kind: "string"`, losing the array-ness entirely.
    const data = Array.from({ length: 12 }, (_, i) => ({
      tags: [`tag-${i}`, `tag-${i + 1}`],
    }));
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.kind).toBe("array");
    expect(arrayItemOf(columns[0]!).kind).toBe("string");
    expect(columns[0]?.filter).toBeNull();
  });

  it("handles rows with empty arrays", () => {
    const data = [{ tags: [] }, { tags: ["foo", "bar"] }];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.kind).toBe("array");
    expect(columns[0]?.filter?.type).toBe("checkbox");
  });
});

// ── record inference ─────────────────────────────────────────────────────────

describe("inferSchemaFromJSON — record inference", () => {
  it("infers 'record' with null filter for plain object values", () => {
    const data = [{ headers: { "content-type": "application/json" } }];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.kind).toBe("record");
    expect(columns[0]?.filter).toBeNull();
  });
});

// ── mixed types fallback ─────────────────────────────────────────────────────

describe("inferSchemaFromJSON — mixed types fallback", () => {
  it("falls back to string/input for columns with mixed types", () => {
    const data = [{ value: "hello" }, { value: 42 }];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.kind).toBe("string");
    expect(columns[0]?.filter?.type).toBe("input");
  });
});

// ── nullable values ──────────────────────────────────────────────────────────

describe("inferSchemaFromJSON — nullable values", () => {
  it("ignores nulls and infers type from remaining values", () => {
    const data = [
      { status: null },
      { status: "active" },
      { status: "inactive" },
    ];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.kind).toBe("enum");
    expect(columns[0]?.filter?.type).toBe("checkbox");
  });

  it("ignores undefined and infers type from remaining values", () => {
    const data = [{ count: undefined }, { count: 1 }, { count: 5 }];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.kind).toBe("number");
  });
});

// ── default column properties ────────────────────────────────────────────────

describe("inferSchemaFromJSON — default column properties", () => {
  it("sets default optional, hidden, sortable, and sheet fields", () => {
    const data = [{ name: "Alice" }];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]).toMatchObject({
      optional: false,
      hidden: false,
      sortable: false,
      enableHiding: true,
      hideHeader: false,
      resizable: false,
      sheet: {},
    });
  });

  it("uses the kind-default display for plain columns", () => {
    const data = [
      {
        count: 100,
        level: "error",
        createdAt: "2024-01-01T00:00:00Z",
        meta: { a: 1 },
      },
      {
        count: 200,
        level: "warn",
        createdAt: "2024-02-01T00:00:00Z",
        meta: { a: 2 },
      },
    ];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.display).toEqual({ type: "number" });
    expect(columns[1]?.display).toEqual({ type: "badge" });
    expect(columns[2]?.display).toEqual({ type: "timestamp" });
    expect(columns[3]?.display).toEqual({ type: "text" });
  });
});

// ── heuristics: one representative per rule family ───────────────────────────

describe("inferSchemaFromJSON — id heuristics", () => {
  it("gives ID-like columns a code display and leaves them unsorted", () => {
    const data = Array.from({ length: 15 }, (_, i) => ({ userId: `usr_${i}` }));
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.display).toEqual({ type: "code" });
    expect(columns[0]?.sortable).toBe(false);
  });

  it("hides trace-scoped IDs and drops their filter (matches col.presets.traceId)", () => {
    const data = Array.from({ length: 15 }, (_, i) => ({
      traceId: `trace_${i}`,
    }));
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.display).toEqual({ type: "code" });
    expect(columns[0]?.hidden).toBe(true);
    expect(columns[0]?.filter).toBeNull();
  });

  it("does NOT hide generic ID columns", () => {
    const data = Array.from({ length: 15 }, (_, i) => ({ userId: `usr_${i}` }));
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.hidden).toBe(false);
    expect(columns[0]?.filter).not.toBeNull();
  });

  it("matches whole words only (e.g. 'hidden' does not contain 'id')", () => {
    const data = Array.from({ length: 15 }, (_, i) => ({
      hidden: `value_${i}`,
    }));
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.display).toEqual({ type: "text" });
  });
});

describe("inferSchemaFromJSON — code-like string heuristics", () => {
  it("gives path/URL-like columns a code display", () => {
    const data = Array.from({ length: 15 }, (_, i) => ({
      path: `/api/v1/resource/${i}`,
    }));
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.display).toEqual({ type: "code" });
  });

  it("gives email columns a code display", () => {
    const data = Array.from({ length: 15 }, (_, i) => ({
      email: `user${i}@example.com`,
    }));
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.display).toEqual({ type: "code" });
  });
});

describe("inferSchemaFromJSON — numeric display heuristics", () => {
  it("gives latency-like columns a heatmap in ms, bounded by the slider filter", () => {
    const data = [{ latency: 100 }, { latency: 200 }, { latency: 300 }];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.display).toEqual({
      type: "heatmap",
      unit: "ms",
      min: 100,
      max: 300,
    });
    expect(columns[0]?.sortable).toBe(true);
  });

  it("omits heatmap bounds entirely when the sample has no variance", () => {
    // No variance → `input` filter, which carries no min/max. The display has
    // to omit the keys rather than carry `min: undefined`: `JSON.stringify`
    // erases the difference, so a descriptor holding one compares unequal to
    // its own round trip while looking identical through JSON.
    const data = [{ latency: 100 }, { latency: 100 }];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.filter?.type).toBe("input");
    expect(Object.keys(columns[0]!.display!)).toEqual(["type", "unit"]);
    expect(columns[0]?.display).toStrictEqual({ type: "heatmap", unit: "ms" });
  });

  it("omits the gauge/bar max when the sample has no variance", () => {
    const { columns: score } = inferSchemaFromJSON([
      { score: 7 },
      { score: 7 },
    ]);
    expect(score[0]?.display).toStrictEqual({ type: "gauge", min: 0 });

    const { columns: progress } = inferSchemaFromJSON([
      { progress: 50 },
      { progress: 50 },
    ]);
    expect(progress[0]?.display).toStrictEqual({ type: "bar", min: 0 });

    const { columns: hp } = inferSchemaFromJSON([{ hp: 3 }, { hp: 3 }]);
    expect(hp[0]?.display).toStrictEqual({ type: "bar", min: 0 });
  });

  it("matches compound latency words that are not in the word list (responseTime)", () => {
    const data = [{ responseTime: 80 }, { responseTime: 120 }];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.display).toMatchObject({ type: "heatmap", unit: "ms" });
  });

  it("gives size-like columns a byte unit", () => {
    const data = [{ fileSize: 1024 }, { fileSize: 2048 }];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.display).toEqual({ type: "number", unit: "B" });
    expect(columns[0]?.sortable).toBe(true);
  });

  it("gives score-like columns a gauge with a zero baseline", () => {
    const data = [{ score: 100 }, { score: 200 }];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.display).toEqual({ type: "gauge", min: 0, max: 200 });
    expect(columns[0]?.sortable).toBe(true);
  });

  it("gives progress-like columns a bar with a zero baseline", () => {
    const data = [{ progress: 10 }, { progress: 90 }];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.display).toEqual({ type: "bar", min: 0, max: 90 });
    expect(columns[0]?.sortable).toBe(true);
  });

  it("sorts timestamps and numbers by default, but not booleans", () => {
    const data = [
      { createdAt: "2024-01-01T00:00:00Z", count: 1, active: true },
      { createdAt: "2024-06-15T12:30:00Z", count: 5, active: false },
    ];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns.map((c) => c.sortable)).toEqual([true, true, false]);
  });
});

describe("inferSchemaFromJSON — boolean display heuristics", () => {
  it("gives favourite-like booleans a star display and hides the header", () => {
    const data = [{ favorite: true }, { favorite: false }];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.display).toEqual({ type: "star" });
    expect(columns[0]?.hideHeader).toBe(true);
  });

  it("does not apply the favourite heuristic to non-boolean columns", () => {
    const data = [{ favorite: "yes" }, { favorite: "no" }];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.display).toEqual({ type: "badge" });
  });
});

describe("inferSchemaFromJSON — enum heuristics", () => {
  it("expands level/severity enum filters by default (matches col.presets.logLevel)", () => {
    const data = [
      { level: "error" },
      { level: "warn" },
      { level: "info" },
      { level: "debug" },
    ];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.kind).toBe("enum");
    expect(columns[0]?.filter?.defaultOpen).toBe(true);
  });

  it("does not expand non-level enum filters", () => {
    const data = [{ status: "active" }, { status: "inactive" }];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.filter?.defaultOpen).toBe(false);
  });

  it("generates a semantic colorMap for status-like enums", () => {
    const data = [
      { status: "active" },
      { status: "pending" },
      { status: "error" },
    ];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.display).toEqual({
      type: "badge",
      colorMap: { active: "#22c55e", pending: "#f59e0b", error: "#ef4444" },
    });
  });

  it("falls back to the neutral palette for status values without meaning", () => {
    const data = [{ status: "alpha" }, { status: "beta" }];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.display.colorMap).toEqual({
      alpha: "#6366f1",
      beta: "#8b5cf6",
    });
  });

  it("does not apply the status heuristic to non-enum columns", () => {
    const data = Array.from({ length: 15 }, (_, i) => ({
      status: `status_${i}`,
    }));
    const { columns } = inferSchemaFromJSON(data);
    // > 10 distinct values → string, not enum → no colorMap
    expect(columns[0]?.kind).toBe("string");
    expect(columns[0]?.display.colorMap).toBeUndefined();
  });
});

// ── column sizing defaults ───────────────────────────────────────────────────

describe("inferSchemaFromJSON — column sizing defaults", () => {
  it("sets a per-kind default size, and none for strings", () => {
    const data = Array.from({ length: 15 }, (_, i) => ({
      active: i % 2 === 0,
      createdAt: `2024-01-01T00:00:${String(i).padStart(2, "0")}Z`,
      count: i,
      level: (["error", "warn", "info"] as const)[i % 3]!,
      message: `msg_${i}`,
    }));
    const { columns } = inferSchemaFromJSON(data);
    expect(columns.map((c) => [c.key, c.size])).toEqual([
      ["active", 100],
      ["createdAt", 220],
      ["count", 120],
      ["level", 130],
      ["message", undefined],
    ]);
  });
});

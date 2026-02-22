import { describe, expect, it } from "vitest";
import { inferSchemaFromJSON } from "./infer";

// ── edge cases ────────────────────────────────────────────────────────────────

describe("inferSchemaFromJSON — edge cases", () => {
  it("returns empty columns for an empty array", () => {
    expect(inferSchemaFromJSON([])).toEqual({ columns: [] });
  });

  it("returns empty columns for a non-array input", () => {
    expect(inferSchemaFromJSON("not an array" as unknown as unknown[])).toEqual(
      {
        columns: [],
      },
    );
  });

  it("skips non-object rows (null, primitives) and processes valid rows", () => {
    const data = [null, undefined, "string", { host: "localhost" }];
    const { columns } = inferSchemaFromJSON(data as unknown[]);
    expect(columns).toHaveLength(1);
    expect(columns[0]?.key).toBe("host");
  });

  it("falls back to string/input for all-null values", () => {
    const data = [{ metadata: null }, { metadata: null }];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.dataType).toBe("string");
    expect(columns[0]?.filter?.type).toBe("input");
  });

  it("preserves column insertion order from the first row", () => {
    const data = [{ z: "z-val", a: "a-val", m: "m-val" }];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns.map((c) => c.key)).toEqual(["z", "a", "m"]);
  });
});

// ── label derivation ──────────────────────────────────────────────────────────

describe("inferSchemaFromJSON — label derivation", () => {
  it("converts camelCase keys to Title Case labels", () => {
    // 2 distinct string values → enum
    const data = [{ hostName: "localhost" }, { hostName: "server1" }];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.label).toBe("Host Name");
  });

  it("converts snake_case keys to space-separated labels", () => {
    const data = [{ created_at: "2024-01-01T00:00:00Z" }];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.label).toBe("Created at");
  });

  it("capitalises the first character of the label", () => {
    const data = [{ level: "error" }];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.label.charAt(0)).toBe(
      columns[0]?.label.charAt(0).toUpperCase(),
    );
  });
});

// ── string / enum inference ───────────────────────────────────────────────────

describe("inferSchemaFromJSON — string inference", () => {
  it("infers 'string' with 'input' filter when there are more than 10 distinct values", () => {
    const data = Array.from({ length: 15 }, (_, i) => ({ host: `host-${i}` }));
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.dataType).toBe("string");
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
    expect(columns[0]?.dataType).toBe("enum");
    expect(columns[0]?.filter?.type).toBe("checkbox");
  });

  it("auto-derives checkbox options from the distinct enum values", () => {
    const data = [{ level: "error" }, { level: "warn" }, { level: "info" }];
    const { columns } = inferSchemaFromJSON(data);
    const options = (columns[0]?.filter as any)?.options as Array<{
      label: string;
      value: string;
    }>;
    expect(options).toHaveLength(3);
    expect(options.map((o) => o.value).sort()).toEqual([
      "error",
      "info",
      "warn",
    ]);
  });
});

// ── boolean inference ─────────────────────────────────────────────────────────

describe("inferSchemaFromJSON — boolean inference", () => {
  it("infers 'boolean' with 'checkbox' filter for true/false values", () => {
    const data = [{ active: true }, { active: false }, { active: true }];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.dataType).toBe("boolean");
    expect(columns[0]?.filter?.type).toBe("checkbox");
  });
});

// ── number inference ──────────────────────────────────────────────────────────

describe("inferSchemaFromJSON — number inference", () => {
  it("infers 'number' with 'slider' filter and correct bounds when min ≠ max", () => {
    const data = [{ latency: 100 }, { latency: 200 }, { latency: 300 }];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.dataType).toBe("number");
    const filter = columns[0]?.filter as any;
    expect(filter?.type).toBe("slider");
    expect(filter?.min).toBe(100);
    expect(filter?.max).toBe(300);
  });

  it("infers 'number' with 'input' filter when all values are equal", () => {
    const data = [{ port: 443 }, { port: 443 }, { port: 443 }];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.dataType).toBe("number");
    expect(columns[0]?.filter?.type).toBe("input");
  });

  it("does not treat small numbers as timestamps", () => {
    const data = [{ count: 42 }, { count: 100 }];
    const { columns } = inferSchemaFromJSON(data);
    // 42 and 100 are below the Unix-ms threshold → number, not timestamp
    expect(columns[0]?.dataType).toBe("number");
    expect(columns[0]?.filter?.type).toBe("slider");
  });
});

// ── timestamp inference ───────────────────────────────────────────────────────

describe("inferSchemaFromJSON — timestamp inference", () => {
  it("infers 'timestamp' from ISO 8601 strings", () => {
    const data = [
      { createdAt: "2024-01-01T00:00:00Z" },
      { createdAt: "2024-06-15T12:30:00Z" },
    ];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.dataType).toBe("timestamp");
    expect(columns[0]?.filter?.type).toBe("timerange");
  });

  it("infers 'timestamp' from ISO 8601 date-only strings", () => {
    const data = [{ date: "2024-01-01" }, { date: "2024-06-15" }];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.dataType).toBe("timestamp");
    expect(columns[0]?.filter?.type).toBe("timerange");
  });

  it("infers 'timestamp' from Unix millisecond numbers (13-digit range)", () => {
    const data = [
      { ts: 1704067200000 }, // 2024-01-01
      { ts: 1717416600000 }, // 2024-06-03
    ];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.dataType).toBe("timestamp");
    expect(columns[0]?.filter?.type).toBe("timerange");
  });
});

// ── array inference ───────────────────────────────────────────────────────────

describe("inferSchemaFromJSON — array inference", () => {
  it("infers 'array' with 'checkbox' when items are strings with ≤ 10 distinct values", () => {
    const data = [{ tags: ["foo", "bar"] }, { tags: ["foo", "baz"] }];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.dataType).toBe("array");
    expect(columns[0]?.filter?.type).toBe("checkbox");
  });

  it("auto-derives checkbox options from the distinct array item values", () => {
    const data = [{ tags: ["foo", "bar"] }, { tags: ["baz"] }];
    const { columns } = inferSchemaFromJSON(data);
    const options = (columns[0]?.filter as any)?.options as Array<{
      label: string;
      value: string;
    }>;
    expect(options.map((o) => o.value).sort()).toEqual(["bar", "baz", "foo"]);
  });

  it("infers non-filterable 'array' when items are not strings", () => {
    const data = [{ ids: [1, 2, 3] }, { ids: [4, 5] }];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.dataType).toBe("array");
    expect(columns[0]?.filter).toBeNull();
  });

  it("infers non-filterable 'array' when string items exceed 10 distinct values", () => {
    const data = Array.from({ length: 12 }, (_, i) => ({
      tags: [`tag-${i}`, `tag-${i + 1}`],
    }));
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.dataType).toBe("array");
    expect(columns[0]?.filter).toBeNull();
  });
});

// ── record inference ──────────────────────────────────────────────────────────

describe("inferSchemaFromJSON — record inference", () => {
  it("infers 'record' with null filter for plain object values", () => {
    const data = [{ headers: { "content-type": "application/json" } }];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.dataType).toBe("record");
    expect(columns[0]?.filter).toBeNull();
  });
});

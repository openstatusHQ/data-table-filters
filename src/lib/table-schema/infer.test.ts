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

  it("converts snake_case keys to title-cased space-separated labels", () => {
    const data = [{ created_at: "2024-01-01T00:00:00Z" }];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.label).toBe("Created At");
  });

  it("capitalises every word in the label", () => {
    const data = [{ some_long_key: "val1" }, { some_long_key: "val2" }];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.label).toBe("Some Long Key");
  });

  it("capitalises single-word keys", () => {
    const data = [{ level: "error" }];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.label).toBe("Level");
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

// ── label derivation: kebab-case ─────────────────────────────────────────────

describe("inferSchemaFromJSON — label derivation (extended)", () => {
  it("converts kebab-case keys to space-separated labels", () => {
    const data = [{ "content-type": "application/json" }];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.label).toBe("Content Type");
  });
});

// ── mixed types fallback ─────────────────────────────────────────────────────

describe("inferSchemaFromJSON — mixed types fallback", () => {
  it("falls back to string/input for columns with mixed types", () => {
    const data = [{ value: "hello" }, { value: 42 }];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.dataType).toBe("string");
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
    expect(columns[0]?.dataType).toBe("enum");
    expect(columns[0]?.filter?.type).toBe("checkbox");
  });

  it("ignores undefined and infers type from remaining values", () => {
    const data = [{ count: undefined }, { count: 1 }, { count: 5 }];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.dataType).toBe("number");
  });
});

// ── array edge cases ─────────────────────────────────────────────────────────

describe("inferSchemaFromJSON — array edge cases", () => {
  it("handles rows with empty arrays", () => {
    const data = [{ tags: [] }, { tags: ["foo", "bar"] }];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.dataType).toBe("array");
    expect(columns[0]?.filter?.type).toBe("checkbox");
  });

  it("sets arrayItemType for enum arrays", () => {
    const data = [{ tags: ["foo", "bar"] }, { tags: ["baz"] }];
    const { columns } = inferSchemaFromJSON(data);
    expect((columns[0] as any)?.arrayItemType).toEqual({
      dataType: "enum",
      enumValues: expect.arrayContaining(["foo", "bar", "baz"]),
    });
  });
});

// ── default column properties ────────────────────────────────────────────────

describe("inferSchemaFromJSON — default column properties", () => {
  it("sets default optional, hidden, sortable, and sheet fields", () => {
    const data = [{ name: "Alice" }];
    const { columns } = inferSchemaFromJSON(data);
    const col = columns[0];
    expect(col?.optional).toBe(false);
    expect(col?.hidden).toBe(false);
    expect(col?.sortable).toBe(false);
    expect(col?.sheet).toEqual({});
  });

  it("sets display type to 'number' for number columns", () => {
    const data = [{ score: 100 }, { score: 200 }];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.display).toEqual({ type: "number" });
  });

  it("sets display type to 'badge' for enum columns", () => {
    const data = [{ level: "error" }, { level: "warn" }];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.display).toEqual({ type: "badge" });
  });

  it("sets display type to 'timestamp' for timestamp columns", () => {
    const data = [{ createdAt: "2024-01-01T00:00:00Z" }];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.display).toEqual({ type: "timestamp" });
  });

  it("sets display type to 'text' for record columns", () => {
    const data = [{ meta: { a: 1 } }];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.display).toEqual({ type: "text" });
  });
});

// ── smart display enhancement ────────────────────────────────────────────────

describe("inferSchemaFromJSON — smart display enhancement", () => {
  it("sets 'code' display for ID-like columns (camelCase)", () => {
    const data = Array.from({ length: 15 }, (_, i) => ({
      userId: `usr_${i}`,
    }));
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.display).toEqual({ type: "code" });
    expect(columns[0]?.sortable).toBe(false);
  });

  it("sets 'code' display for ID-like columns (snake_case)", () => {
    const data = Array.from({ length: 15 }, (_, i) => ({
      request_id: `req_${i}`,
    }));
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.display).toEqual({ type: "code" });
    expect(columns[0]?.sortable).toBe(false);
  });

  it("sets 'code' display for uuid columns", () => {
    const data = Array.from({ length: 15 }, (_, i) => ({
      uuid: `550e8400-e29b-41d4-a716-${i}`,
    }));
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.display).toEqual({ type: "code" });
  });

  it("sets 'code' display for path-like columns", () => {
    const data = Array.from({ length: 15 }, (_, i) => ({
      path: `/api/v1/resource/${i}`,
    }));
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.display).toEqual({ type: "code" });
  });

  it("sets 'code' display for host columns", () => {
    const data = Array.from({ length: 15 }, (_, i) => ({
      host: `server-${i}.example.com`,
    }));
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.display).toEqual({ type: "code" });
  });

  it("sets number display with 'ms' unit for latency columns", () => {
    const data = [{ latency: 100 }, { latency: 200 }, { latency: 300 }];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.display).toEqual({ type: "number", unit: "ms" });
    expect(columns[0]?.sortable).toBe(true);
  });

  it("sets number display with 'ms' unit for duration columns", () => {
    const data = [{ duration: 50 }, { duration: 150 }];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.display).toEqual({ type: "number", unit: "ms" });
    expect(columns[0]?.sortable).toBe(true);
  });

  it("sets number display with 'ms' unit for responseTime (compound word)", () => {
    const data = [{ responseTime: 80 }, { responseTime: 120 }];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.display).toEqual({ type: "number", unit: "ms" });
    expect(columns[0]?.sortable).toBe(true);
  });

  it("sets number display with 'B' unit for size columns", () => {
    const data = [{ fileSize: 1024 }, { fileSize: 2048 }];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.display).toEqual({ type: "number", unit: "B" });
    expect(columns[0]?.sortable).toBe(true);
  });

  it("sets sortable for timestamp columns", () => {
    const data = [
      { createdAt: "2024-01-01T00:00:00Z" },
      { createdAt: "2024-06-15T12:30:00Z" },
    ];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.sortable).toBe(true);
  });

  it("sets sortable for generic number columns", () => {
    const data = [{ score: 10 }, { score: 90 }];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.sortable).toBe(true);
  });

  it("does not set sortable for boolean columns", () => {
    const data = [{ active: true }, { active: false }];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.sortable).toBe(false);
  });

  it("does not match partial words (e.g. 'hidden' does not match 'id')", () => {
    const data = Array.from({ length: 15 }, (_, i) => ({
      hidden: `value_${i}`,
    }));
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.display).toEqual({ type: "text" });
  });
});

// ── column sizing defaults ───────────────────────────────────────────────────

describe("inferSchemaFromJSON — column sizing defaults", () => {
  it("sets size 100 for boolean columns", () => {
    const data = [{ active: true }, { active: false }];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.size).toBe(100);
  });

  it("sets size 180 for timestamp columns", () => {
    const data = [{ createdAt: "2024-01-01T00:00:00Z" }];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.size).toBe(180);
  });

  it("sets size 120 for number columns", () => {
    const data = [{ score: 10 }, { score: 90 }];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.size).toBe(120);
  });

  it("sets size 130 for enum columns", () => {
    const data = [{ level: "error" }, { level: "warn" }, { level: "info" }];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.size).toBe(130);
  });

  it("does not set size for string columns", () => {
    const data = Array.from({ length: 15 }, (_, i) => ({
      message: `msg_${i}`,
    }));
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.size).toBeUndefined();
  });
});

// ── preset-aware enhancement ─────────────────────────────────────────────────

describe("inferSchemaFromJSON — preset-aware enhancement", () => {
  it("sets defaultOpen for 'level' enum columns (matches col.presets.logLevel)", () => {
    const data = [
      { level: "error" },
      { level: "warn" },
      { level: "info" },
      { level: "debug" },
    ];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.dataType).toBe("enum");
    expect(columns[0]?.filter?.defaultOpen).toBe(true);
  });

  it("sets defaultOpen for 'severity' enum columns", () => {
    const data = [
      { severity: "critical" },
      { severity: "high" },
      { severity: "low" },
    ];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.filter?.defaultOpen).toBe(true);
  });

  it("sets defaultOpen for 'logLevel' camelCase enum columns", () => {
    const data = [
      { logLevel: "error" },
      { logLevel: "warn" },
      { logLevel: "info" },
    ];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.filter?.defaultOpen).toBe(true);
  });

  it("does not set defaultOpen for non-level enum columns", () => {
    const data = [{ status: "active" }, { status: "inactive" }];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.filter?.defaultOpen).toBe(false);
  });

  it("hides traceId columns and removes filter (matches col.presets.traceId)", () => {
    const data = Array.from({ length: 15 }, (_, i) => ({
      traceId: `trace_${i}`,
    }));
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.display).toEqual({ type: "code" });
    expect(columns[0]?.hidden).toBe(true);
    expect(columns[0]?.filter).toBeNull();
  });

  it("hides requestId columns and removes filter", () => {
    const data = Array.from({ length: 15 }, (_, i) => ({
      requestId: `req_${i}`,
    }));
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.hidden).toBe(true);
    expect(columns[0]?.filter).toBeNull();
  });

  it("hides span_id columns (snake_case)", () => {
    const data = Array.from({ length: 15 }, (_, i) => ({
      span_id: `span_${i}`,
    }));
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.hidden).toBe(true);
    expect(columns[0]?.filter).toBeNull();
  });

  it("does NOT hide generic ID columns like userId", () => {
    const data = Array.from({ length: 15 }, (_, i) => ({
      userId: `usr_${i}`,
    }));
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.display).toEqual({ type: "code" });
    expect(columns[0]?.hidden).toBe(false);
    expect(columns[0]?.filter).not.toBeNull();
  });

  it("does NOT hide plain 'id' columns", () => {
    const data = Array.from({ length: 15 }, (_, i) => ({
      id: `item_${i}`,
    }));
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.hidden).toBe(false);
  });
});

// ── visual heuristics: favorites ────────────────────────────────────────────

describe("inferSchemaFromJSON — favorite/starred heuristics", () => {
  it("sets 'star' display for 'favorite' boolean columns", () => {
    const data = [{ favorite: true }, { favorite: false }];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.display).toEqual({ type: "star" });
    expect(columns[0]?.hideHeader).toBe(true);
  });

  it("sets 'star' display for 'starred' boolean columns", () => {
    const data = [{ starred: true }, { starred: false }];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.display).toEqual({ type: "star" });
    expect(columns[0]?.hideHeader).toBe(true);
  });

  it("sets 'star' display for 'bookmarked' boolean columns", () => {
    const data = [{ bookmarked: true }, { bookmarked: false }];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.display).toEqual({ type: "star" });
    expect(columns[0]?.hideHeader).toBe(true);
  });

  it("does not apply favorite heuristic to non-boolean columns", () => {
    const data = [{ favorite: "yes" }, { favorite: "no" }];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.display).toEqual({ type: "badge" });
  });
});

// ── visual heuristics: email ────────────────────────────────────────────────

describe("inferSchemaFromJSON — email heuristics", () => {
  it("sets 'code' display for 'email' string columns", () => {
    const data = Array.from({ length: 15 }, (_, i) => ({
      email: `user${i}@example.com`,
    }));
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.display).toEqual({ type: "code" });
  });

  it("sets 'code' display for 'mail' string columns", () => {
    const data = Array.from({ length: 15 }, (_, i) => ({
      mail: `user${i}@example.com`,
    }));
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.display).toEqual({ type: "code" });
  });
});

// ── visual heuristics: link/href/website ────────────────────────────────────

describe("inferSchemaFromJSON — link/href/website heuristics", () => {
  it("sets 'code' display for 'link' string columns", () => {
    const data = Array.from({ length: 15 }, (_, i) => ({
      link: `https://example.com/${i}`,
    }));
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.display).toEqual({ type: "code" });
  });

  it("sets 'code' display for 'href' string columns", () => {
    const data = Array.from({ length: 15 }, (_, i) => ({
      href: `https://example.com/${i}`,
    }));
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.display).toEqual({ type: "code" });
  });

  it("sets 'code' display for 'website' string columns", () => {
    const data = Array.from({ length: 15 }, (_, i) => ({
      website: `https://example.com/${i}`,
    }));
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.display).toEqual({ type: "code" });
  });
});

// ── visual heuristics: status/state enums ───────────────────────────────────

describe("inferSchemaFromJSON — status/state enum heuristics", () => {
  it("generates semantic colorMap for 'status' enum columns", () => {
    const data = [
      { status: "active" },
      { status: "pending" },
      { status: "error" },
    ];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.display).toEqual({
      type: "badge",
      colorMap: {
        active: "#22c55e",
        pending: "#f59e0b",
        error: "#ef4444",
      },
    });
  });

  it("generates semantic colorMap for 'state' enum columns", () => {
    const data = [
      { state: "published" },
      { state: "draft" },
      { state: "archived" },
    ];
    const { columns } = inferSchemaFromJSON(data);
    expect(columns[0]?.display).toEqual({
      type: "badge",
      colorMap: {
        published: "#22c55e",
        draft: "#f59e0b",
        archived: "#6b7280",
      },
    });
  });

  it("uses neutral palette for unknown status values", () => {
    const data = [{ status: "alpha" }, { status: "beta" }];
    const { columns } = inferSchemaFromJSON(data);
    const colorMap = (columns[0]?.display as any)?.colorMap;
    expect(colorMap).toBeDefined();
    expect(colorMap.alpha).toBe("#6366f1");
    expect(colorMap.beta).toBe("#8b5cf6");
  });

  it("does not apply status heuristic to non-enum columns", () => {
    const data = Array.from({ length: 15 }, (_, i) => ({
      status: `status_${i}`,
    }));
    const { columns } = inferSchemaFromJSON(data);
    // >10 distinct values → string, not enum → no colorMap
    expect(columns[0]?.dataType).toBe("string");
    expect((columns[0]?.display as any)?.colorMap).toBeUndefined();
  });
});

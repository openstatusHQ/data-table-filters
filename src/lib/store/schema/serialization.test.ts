import { describe, expect, it } from "vitest";
import { field } from "./field";
import {
  getSchemaDefaults,
  serializeState,
  parseState,
  validateState,
  mergeWithDefaults,
  isStateEqual,
  stateToSearchString,
} from "./serialization";

const schema = {
  path: field.string(),
  level: field.array(field.stringLiteral(["error", "warn", "info"] as const)),
  latency: field.array(field.number()).delimiter("-"),
  sort: field.sort(),
};

describe("getSchemaDefaults", () => {
  it("returns default values for all fields", () => {
    const defaults = getSchemaDefaults(schema);
    expect(defaults).toEqual({
      path: null,
      level: [],
      latency: [],
      sort: null,
    });
  });

  it("respects custom defaults", () => {
    const custom = {
      name: field.string().default("unknown"),
      count: field.number().default(0),
    };
    expect(getSchemaDefaults(custom)).toEqual({ name: "unknown", count: 0 });
  });
});

describe("serializeState", () => {
  it("serializes state to string map", () => {
    const result = serializeState(schema, {
      path: "api",
      level: ["error", "warn"],
    });
    expect(result.path).toBe("api");
    expect(result.level).toBe("error,warn");
  });

  it("omits empty/null values", () => {
    const result = serializeState(schema, { path: null, level: [] });
    expect(result).toEqual({});
  });

  it("serializes sort field", () => {
    const result = serializeState(schema, {
      sort: { id: "latency", desc: true },
    });
    expect(result.sort).toBe("latency.desc");
  });

  it("ignores keys not in schema", () => {
    const result = serializeState(schema, { unknown: "value" } as any);
    expect(result).toEqual({});
  });
});

describe("parseState", () => {
  it("parses string map to state", () => {
    const result = parseState(schema, {
      path: "api",
      level: "error,warn",
    });
    expect(result.path).toBe("api");
    expect(result.level).toEqual(["error", "warn"]);
  });

  it("skips undefined values", () => {
    const result = parseState(schema, { path: undefined });
    expect(result).toEqual({});
  });

  it("handles array values from URL (Next.js passes arrays)", () => {
    const result = parseState(schema, { level: ["error", "warn"] });
    expect(result.level).toBeDefined();
  });

  it("parses sort string", () => {
    const result = parseState(schema, { sort: "name.asc" });
    expect(result.sort).toEqual({ id: "name", desc: false });
  });
});

describe("validateState", () => {
  it("returns defaults for null state", () => {
    const result = validateState(schema, null);
    expect(result).toEqual(getSchemaDefaults(schema));
  });

  it("returns defaults for non-object state", () => {
    const result = validateState(schema, "invalid");
    expect(result).toEqual(getSchemaDefaults(schema));
  });

  it("validates and preserves valid state values", () => {
    const result = validateState(schema, { path: "test", level: ["error"] });
    expect(result.path).toBe("test");
    expect(result.level).toEqual(["error"]);
  });

  it("uses defaults for missing keys", () => {
    const result = validateState(schema, { path: "test" });
    expect(result.level).toEqual([]);
    expect(result.sort).toBeNull();
  });
});

describe("mergeWithDefaults", () => {
  it("merges partial state with defaults", () => {
    const result = mergeWithDefaults(schema, { path: "test" });
    expect(result.path).toBe("test");
    expect(result.level).toEqual([]);
    expect(result.sort).toBeNull();
  });

  it("overrides defaults with provided values", () => {
    const result = mergeWithDefaults(schema, { level: ["error"] });
    expect(result.level).toEqual(["error"]);
  });
});

describe("isStateEqual", () => {
  it("returns true for identical primitives", () => {
    expect(isStateEqual({ a: 1, b: "x" }, { a: 1, b: "x" })).toBe(true);
  });

  it("returns false for different primitives", () => {
    expect(isStateEqual({ a: 1 }, { a: 2 })).toBe(false);
  });

  it("returns false for different key counts", () => {
    expect(isStateEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });

  it("compares arrays element-by-element", () => {
    expect(isStateEqual({ a: [1, 2, 3] }, { a: [1, 2, 3] })).toBe(true);
    expect(isStateEqual({ a: [1, 2] }, { a: [1, 3] })).toBe(false);
  });

  it("compares arrays of different lengths", () => {
    expect(isStateEqual({ a: [1, 2] }, { a: [1] })).toBe(false);
  });

  it("compares Date objects by time", () => {
    const d = new Date("2024-01-15");
    expect(isStateEqual({ a: d }, { a: new Date(d.getTime()) })).toBe(true);
    expect(isStateEqual({ a: d }, { a: new Date("2024-02-01") })).toBe(false);
  });

  it("compares Date arrays", () => {
    const d1 = new Date("2024-01-01");
    const d2 = new Date("2024-01-31");
    expect(isStateEqual({ a: [d1, d2] }, { a: [new Date(d1.getTime()), new Date(d2.getTime())] })).toBe(true);
  });

  it("compares nested objects (sort field)", () => {
    expect(
      isStateEqual(
        { sort: { id: "a", desc: true } },
        { sort: { id: "a", desc: true } },
      ),
    ).toBe(true);
    expect(
      isStateEqual(
        { sort: { id: "a", desc: true } },
        { sort: { id: "a", desc: false } },
      ),
    ).toBe(false);
  });

  it("handles null values", () => {
    expect(isStateEqual({ a: null }, { a: null })).toBe(true);
  });
});

describe("stateToSearchString", () => {
  it("returns empty string for empty state", () => {
    expect(stateToSearchString(schema, {})).toBe("");
  });

  it("returns empty string for null/default values", () => {
    expect(stateToSearchString(schema, { path: null, level: [] })).toBe("");
  });

  it("generates URL search string", () => {
    const result = stateToSearchString(schema, { path: "test", level: ["error"] });
    expect(result).toContain("?");
    expect(result).toContain("path=test");
    expect(result).toContain("level=error");
  });

  it("includes sort in search string", () => {
    const result = stateToSearchString(schema, {
      sort: { id: "latency", desc: true },
    });
    expect(result).toContain("sort=latency.desc");
  });
});

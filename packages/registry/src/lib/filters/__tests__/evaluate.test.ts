import { describe, expect, it } from "vitest";
import { evaluateOp, getValueAtKey } from "../evaluate";
import type { FilterOp } from "../types";

// Compile-time exhaustiveness: a seventh `FilterOp` member makes this record
// incomplete, so the suite fails to build rather than silently skipping the
// new op.
const OP_COVERAGE: Record<FilterOp["op"], true> = {
  substring: true,
  equals: true,
  oneOf: true,
  overlaps: true,
  numberRange: true,
  dateRange: true,
};

it("covers every FilterOp member", () => {
  expect(Object.keys(OP_COVERAGE).sort()).toEqual([
    "dateRange",
    "equals",
    "numberRange",
    "oneOf",
    "overlaps",
    "substring",
  ]);
});

// ── substring ───────────────────────────────────────────────────────────────

describe("evaluateOp — substring", () => {
  const op = (value: string): FilterOp => ({
    op: "substring",
    key: "host",
    value,
  });

  it("matches a substring", () => {
    expect(evaluateOp(op("cloud"), "api.cloudflare.com")).toBe(true);
  });

  it("is case-INsensitive in both directions", () => {
    // The SQL side uses `ilike`; the in-memory side had been case-sensitive,
    // so the two disagreed on the infinite route.
    expect(evaluateOp(op("CLOUD"), "api.cloudflare.com")).toBe(true);
    expect(evaluateOp(op("cloud"), "API.CLOUDFLARE.COM")).toBe(true);
    expect(evaluateOp(op("ClOuD"), "api.CloudFlare.com")).toBe(true);
  });

  it("does not match an absent needle", () => {
    expect(evaluateOp(op("vercel"), "api.cloudflare.com")).toBe(false);
  });

  it("stringifies a non-string cell", () => {
    expect(evaluateOp(op("50"), 1500)).toBe(true);
    expect(evaluateOp(op("true"), true)).toBe(true);
  });

  it("is false for a null or undefined cell", () => {
    expect(evaluateOp(op("a"), null)).toBe(false);
    expect(evaluateOp(op("a"), undefined)).toBe(false);
  });

  it("is false rather than throwing for a nonsense cell", () => {
    expect(evaluateOp(op("object"), {})).toBe(true); // "[object Object]"
    expect(evaluateOp(op("zzz"), {})).toBe(false);
  });
});

// ── equals ──────────────────────────────────────────────────────────────────

describe("evaluateOp — equals", () => {
  const op = (value: string | number | boolean): FilterOp => ({
    op: "equals",
    key: "latency",
    value,
  });

  it("matches an identical scalar", () => {
    expect(evaluateOp(op(500), 500)).toBe(true);
    expect(evaluateOp(op("fra"), "fra")).toBe(true);
    expect(evaluateOp(op(true), true)).toBe(true);
  });

  it("does not match a different scalar", () => {
    expect(evaluateOp(op(500), 501)).toBe(false);
    expect(evaluateOp(op("fra"), "ams")).toBe(false);
  });

  it("does not do a substring match on a stringified number", () => {
    // The old TanStack path made the needle "5" match 1500.
    expect(evaluateOp(op(5), 1500)).toBe(false);
    expect(evaluateOp(op("5"), 1500)).toBe(false);
  });

  it("compares a number cell against a string value from the URL", () => {
    expect(evaluateOp(op("500"), 500)).toBe(true);
    expect(evaluateOp(op("500"), 501)).toBe(false);
  });

  it("compares a string cell against a non-string value", () => {
    expect(evaluateOp(op(500), "500")).toBe(true);
    expect(evaluateOp(op(true), "true")).toBe(true);
  });

  it("compares a boolean cell against its string spelling", () => {
    expect(evaluateOp(op("true"), true)).toBe(true);
    expect(evaluateOp(op("false"), false)).toBe(true);
  });

  it("0 does NOT match false", () => {
    // Cross-type comparison goes through String(), never through `==`, so the
    // JS coercion table cannot leak in.
    expect(evaluateOp(op(false), 0)).toBe(false);
    expect(evaluateOp(op(0), false)).toBe(false);
  });

  it("1 does NOT match true", () => {
    expect(evaluateOp(op(true), 1)).toBe(false);
    expect(evaluateOp(op(1), true)).toBe(false);
  });

  it('"" does NOT match 0 or false', () => {
    expect(evaluateOp(op(""), 0)).toBe(false);
    expect(evaluateOp(op(""), false)).toBe(false);
  });

  it("is false for a null, undefined or object cell", () => {
    expect(evaluateOp(op("x"), null)).toBe(false);
    expect(evaluateOp(op("x"), undefined)).toBe(false);
    expect(evaluateOp(op("x"), {})).toBe(false);
  });
});

// ── oneOf ───────────────────────────────────────────────────────────────────

describe("evaluateOp — oneOf", () => {
  const op = (values: Array<string | number | boolean>): FilterOp => ({
    op: "oneOf",
    key: "status",
    values,
  });

  it("matches set membership, not a range", () => {
    // The whole point of RFC #87: selecting 200 and 500 must not admit 404.
    const selected = op([200, 500]);
    expect(evaluateOp(selected, 200)).toBe(true);
    expect(evaluateOp(selected, 500)).toBe(true);
    expect(evaluateOp(selected, 201)).toBe(false);
    expect(evaluateOp(selected, 301)).toBe(false);
    expect(evaluateOp(selected, 404)).toBe(false);
    expect(evaluateOp(selected, 429)).toBe(false);
  });

  it("matches a member other than the first", () => {
    expect(evaluateOp(op(["a", "b", "c"]), "c")).toBe(true);
  });

  it("compares a number cell against string values from the URL", () => {
    expect(evaluateOp(op(["200", "500"]), 200)).toBe(true);
    expect(evaluateOp(op(["200", "500"]), 404)).toBe(false);
  });

  it("compares a string cell against number values", () => {
    expect(evaluateOp(op([200, 500]), "500")).toBe(true);
  });

  it("0 is not matched by a set containing false", () => {
    expect(evaluateOp(op([false]), 0)).toBe(false);
    expect(evaluateOp(op([false, true]), 1)).toBe(false);
  });

  it("false is matched by a set containing false or 'false'", () => {
    expect(evaluateOp(op([false]), false)).toBe(true);
    expect(evaluateOp(op(["false"]), false)).toBe(true);
  });

  it("an empty set matches nothing", () => {
    expect(evaluateOp(op([]), 200)).toBe(false);
  });

  it("is false for a null or undefined cell", () => {
    expect(evaluateOp(op([200]), null)).toBe(false);
    expect(evaluateOp(op([200]), undefined)).toBe(false);
  });
});

// ── overlaps ────────────────────────────────────────────────────────────────

describe("evaluateOp — overlaps", () => {
  const op = (values: Array<string | number | boolean>): FilterOp => ({
    op: "overlaps",
    key: "regions",
    values,
  });

  it("matches when the first array element is selected", () => {
    expect(evaluateOp(op(["ams"]), ["ams", "fra", "iad"])).toBe(true);
  });

  it("matches a NON-FIRST array element", () => {
    // The infinite route used to compare only `row[key][0]`, so "iad" never
    // matched a row whose regions started with "ams".
    expect(evaluateOp(op(["iad"]), ["ams", "fra", "iad"])).toBe(true);
    expect(evaluateOp(op(["fra"]), ["ams", "fra", "iad"])).toBe(true);
  });

  it("matches when any selected value intersects the cell", () => {
    expect(evaluateOp(op(["gru", "iad"]), ["ams", "iad"])).toBe(true);
  });

  it("is false on an empty intersection", () => {
    expect(evaluateOp(op(["gru", "hnd"]), ["ams", "fra", "iad"])).toBe(false);
  });

  it("treats a SCALAR cell as a one-element set", () => {
    expect(evaluateOp(op(["fra"]), "fra")).toBe(true);
    expect(evaluateOp(op(["fra", "ams"]), "ams")).toBe(true);
    expect(evaluateOp(op(["fra"]), "iad")).toBe(false);
  });

  it("is false for an empty array cell", () => {
    expect(evaluateOp(op(["fra"]), [])).toBe(false);
  });

  it("is false for an empty selection", () => {
    expect(evaluateOp(op([]), ["ams"])).toBe(false);
  });

  it("compares members cross-type", () => {
    expect(evaluateOp(op(["200"]), [200, 500])).toBe(true);
    expect(evaluateOp(op([200]), ["200", "500"])).toBe(true);
  });

  it("does not let 0 match false inside an array cell", () => {
    expect(evaluateOp(op([false]), [0, 2])).toBe(false);
  });

  it("is false for a null cell", () => {
    expect(evaluateOp(op(["fra"]), null)).toBe(false);
    expect(evaluateOp(op(["fra"]), undefined)).toBe(false);
  });
});

// ── numberRange ─────────────────────────────────────────────────────────────

describe("evaluateOp — numberRange", () => {
  const op = (min: number, max: number): FilterOp => ({
    op: "numberRange",
    key: "latency",
    min,
    max,
  });

  it("is INCLUSIVE on both ends", () => {
    expect(evaluateOp(op(100, 500), 100)).toBe(true);
    expect(evaluateOp(op(100, 500), 500)).toBe(true);
  });

  it("matches the interior", () => {
    expect(evaluateOp(op(100, 500), 300)).toBe(true);
    expect(evaluateOp(op(100, 500), 100.0001)).toBe(true);
  });

  it("excludes values outside the bounds", () => {
    expect(evaluateOp(op(100, 500), 99)).toBe(false);
    expect(evaluateOp(op(100, 500), 501)).toBe(false);
    expect(evaluateOp(op(100, 500), 99.9999)).toBe(false);
  });

  it("matches a degenerate (single-handle) range exactly", () => {
    expect(evaluateOp(op(500, 500), 500)).toBe(true);
    expect(evaluateOp(op(500, 500), 500.5)).toBe(false);
  });

  it("coerces a numeric string cell", () => {
    expect(evaluateOp(op(100, 500), "300")).toBe(true);
    expect(evaluateOp(op(100, 500), "600")).toBe(false);
  });

  it("includes 0 when 0 is in range", () => {
    expect(evaluateOp(op(0, 100), 0)).toBe(true);
    expect(evaluateOp(op(-10, 10), -10)).toBe(true);
  });

  it("is false for non-numeric cells", () => {
    expect(evaluateOp(op(0, 100), null)).toBe(false);
    expect(evaluateOp(op(0, 100), undefined)).toBe(false);
    expect(evaluateOp(op(0, 100), "abc")).toBe(false);
    expect(evaluateOp(op(0, 100), "")).toBe(false);
    expect(evaluateOp(op(0, 100), Number.NaN)).toBe(false);
    expect(evaluateOp(op(0, 100), {})).toBe(false);
  });

  it("does not treat a boolean cell as 0 or 1", () => {
    expect(evaluateOp(op(0, 100), false)).toBe(false);
    expect(evaluateOp(op(0, 100), true)).toBe(false);
  });
});

// ── dateRange ───────────────────────────────────────────────────────────────

describe("evaluateOp — dateRange", () => {
  const from = new Date("2024-01-15T00:00:00.000Z");
  const to = new Date("2024-01-20T23:59:59.999Z");
  const op: FilterOp = { op: "dateRange", key: "date", from, to };

  it("is INCLUSIVE on both ends", () => {
    expect(evaluateOp(op, new Date(from.getTime()))).toBe(true);
    expect(evaluateOp(op, new Date(to.getTime()))).toBe(true);
  });

  it("matches the interior", () => {
    expect(evaluateOp(op, new Date("2024-01-17T12:00:00.000Z"))).toBe(true);
  });

  it("excludes instants one millisecond outside", () => {
    expect(evaluateOp(op, new Date(from.getTime() - 1))).toBe(false);
    expect(evaluateOp(op, new Date(to.getTime() + 1))).toBe(false);
  });

  it("coerces an ISO string cell", () => {
    expect(evaluateOp(op, "2024-01-17T12:00:00.000Z")).toBe(true);
    expect(evaluateOp(op, "2024-02-17T12:00:00.000Z")).toBe(false);
  });

  it("coerces an epoch-millis number cell", () => {
    expect(evaluateOp(op, from.getTime())).toBe(true);
    expect(evaluateOp(op, to.getTime() + 1)).toBe(false);
  });

  it("matches a zero-width range exactly", () => {
    const at = new Date("2024-01-15T08:00:00.000Z");
    const zero: FilterOp = { op: "dateRange", key: "date", from: at, to: at };
    expect(evaluateOp(zero, new Date(at.getTime()))).toBe(true);
    expect(evaluateOp(zero, new Date(at.getTime() + 1))).toBe(false);
  });

  it("is false for uncoercible cells", () => {
    expect(evaluateOp(op, null)).toBe(false);
    expect(evaluateOp(op, undefined)).toBe(false);
    expect(evaluateOp(op, "not-a-date")).toBe(false);
    expect(evaluateOp(op, "")).toBe(false);
    expect(evaluateOp(op, new Date("nope"))).toBe(false);
    expect(evaluateOp(op, {})).toBe(false);
    expect(evaluateOp(op, true)).toBe(false);
  });
});

// ── getValueAtKey ───────────────────────────────────────────────────────────

describe("getValueAtKey", () => {
  it("reads a plain key", () => {
    expect(getValueAtKey({ host: "api.dev" }, "host")).toBe("api.dev");
  });

  it("reads a FLAT literal dotted key", () => {
    expect(getValueAtKey({ "timing.dns": 12 }, "timing.dns")).toBe(12);
  });

  it("reads a NESTED object through a dotted key", () => {
    expect(getValueAtKey({ timing: { dns: 12 } }, "timing.dns")).toBe(12);
  });

  it("gives the FLAT key precedence over the nested path", () => {
    // Documented: the flat shape is the wire shape, so it wins.
    const row = { "timing.dns": 1, timing: { dns: 999 } };
    expect(getValueAtKey(row, "timing.dns")).toBe(1);
  });

  it("walks more than two segments", () => {
    expect(getValueAtKey({ a: { b: { c: 3 } } }, "a.b.c")).toBe(3);
  });

  it("returns undefined for a missing plain key", () => {
    expect(getValueAtKey({ host: "api.dev" }, "region")).toBeUndefined();
  });

  it("returns undefined for a missing dotted key", () => {
    expect(getValueAtKey({ timing: { tls: 1 } }, "timing.dns")).toBeUndefined();
    expect(getValueAtKey({ host: "api.dev" }, "timing.dns")).toBeUndefined();
  });

  it("returns undefined when the path runs into a non-object", () => {
    expect(getValueAtKey({ timing: 5 }, "timing.dns")).toBeUndefined();
    expect(getValueAtKey({ timing: null }, "timing.dns")).toBeUndefined();
  });

  it("returns undefined for a null row", () => {
    expect(getValueAtKey(null, "host")).toBeUndefined();
    expect(getValueAtKey(null, "timing.dns")).toBeUndefined();
  });

  it("returns undefined for a non-object row", () => {
    expect(getValueAtKey(undefined, "host")).toBeUndefined();
    expect(getValueAtKey("string", "host")).toBeUndefined();
    expect(getValueAtKey(42, "host")).toBeUndefined();
  });

  it("distinguishes a stored null from a missing key", () => {
    expect(getValueAtKey({ host: null }, "host")).toBeNull();
    expect(getValueAtKey({ "timing.dns": null }, "timing.dns")).toBeNull();
  });

  it("preserves falsy stored values", () => {
    expect(getValueAtKey({ n: 0 }, "n")).toBe(0);
    expect(getValueAtKey({ b: false }, "b")).toBe(false);
    expect(getValueAtKey({ s: "" }, "s")).toBe("");
  });

  it("returns array cells whole", () => {
    expect(getValueAtKey({ regions: ["ams", "fra"] }, "regions")).toEqual([
      "ams",
      "fra",
    ]);
  });
});

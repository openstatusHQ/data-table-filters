import { describe, expect, it } from "vitest";
import { isActive, normalize } from "../normalize";
import type { ColKind, FilterOp, FilterSpec, FilterType } from "../types";

// ── Exhaustiveness anchors ──────────────────────────────────────────────────
//
// The structural claim below ("numberRange is unreachable from a checkbox") is
// only a property if it is quantified over *every* ColKind. These two constants
// are compile-time-pinned to the unions, so adding a ninth ColKind or a fifth
// FilterType breaks this file rather than silently narrowing the property.

const ALL_KINDS = [
  "string",
  "number",
  "boolean",
  "timestamp",
  "enum",
  "array",
  "record",
  "select",
] as const satisfies readonly ColKind[];

const ALL_TYPES = [
  "input",
  "checkbox",
  "slider",
  "timerange",
] as const satisfies readonly FilterType[];

type MissingKind = Exclude<ColKind, (typeof ALL_KINDS)[number]>;
type MissingType = Exclude<FilterType, (typeof ALL_TYPES)[number]>;
const _kindsExhaustive: [MissingKind] extends [never] ? true : never = true;
const _typesExhaustive: [MissingType] extends [never] ? true : never = true;
void _kindsExhaustive;
void _typesExhaustive;

function spec(
  type: FilterType,
  kind: ColKind,
  extra: Partial<FilterSpec> = {},
): FilterSpec {
  return { key: "col", type, kind, ...extra };
}

/** Narrow an op to one variant, failing loudly instead of casting blind. */
function expectOp<TOp extends FilterOp["op"]>(
  op: FilterOp | null,
  kind: TOp,
): Extract<FilterOp, { op: TOp }> {
  expect(op).not.toBeNull();
  expect(op!.op).toBe(kind);
  return op as Extract<FilterOp, { op: TOp }>;
}

// ── The normalization table ─────────────────────────────────────────────────
//
// Each row of the table in RFC #87 gets an assertion. Dispatch is on the
// declared (type, kind) pair, so these are the whole contract.

describe("normalize — the normalization table", () => {
  it("input + string → substring", () => {
    expect(normalize(spec("input", "string"), "Ber")).toEqual({
      op: "substring",
      key: "col",
      value: "Ber",
    });
  });

  it("input + enum → substring", () => {
    expect(normalize(spec("input", "enum"), "err")).toEqual({
      op: "substring",
      key: "col",
      value: "err",
    });
  });

  it("input + string keeps the needle verbatim (case folding lives in the engines)", () => {
    // normalize does not lowercase — `evaluateOp` and SQL `ilike` do. Folding
    // here as well would be a second place for the two to disagree.
    expect(normalize(spec("input", "string"), "BeRlIn")).toEqual({
      op: "substring",
      key: "col",
      value: "BeRlIn",
    });
  });

  it("input + number → equals, not substring", () => {
    // The regression: a substring match on a stringified number made "5"
    // match 1500.
    expect(normalize(spec("input", "number"), 5)).toEqual({
      op: "equals",
      key: "col",
      value: 5,
    });
  });

  it("checkbox + enum → oneOf", () => {
    expect(normalize(spec("checkbox", "enum"), ["error", "warn"])).toEqual({
      op: "oneOf",
      key: "col",
      values: ["error", "warn"],
    });
  });

  it("checkbox + string → oneOf", () => {
    expect(normalize(spec("checkbox", "string"), ["a", "b"])).toEqual({
      op: "oneOf",
      key: "col",
      values: ["a", "b"],
    });
  });

  it("checkbox + boolean → oneOf", () => {
    expect(normalize(spec("checkbox", "boolean"), [true, false])).toEqual({
      op: "oneOf",
      key: "col",
      values: [true, false],
    });
  });

  it("checkbox + array → overlaps", () => {
    expect(
      normalize(spec("checkbox", "array", { itemKind: "enum" }), [
        "ams",
        "fra",
      ]),
    ).toEqual({ op: "overlaps", key: "col", values: ["ams", "fra"] });
  });

  it("checkbox wraps a bare scalar into a one-element set", () => {
    expect(normalize(spec("checkbox", "enum"), "error")).toEqual({
      op: "oneOf",
      key: "col",
      values: ["error"],
    });
  });

  it("slider + number, 1 value → a degenerate numberRange", () => {
    // Not an equality: the two disagree the moment the column holds
    // non-integers.
    expect(normalize(spec("slider", "number"), [500])).toEqual({
      op: "numberRange",
      key: "col",
      min: 500,
      max: 500,
    });
  });

  it("slider + number, 2 values → numberRange", () => {
    expect(normalize(spec("slider", "number"), [100, 500])).toEqual({
      op: "numberRange",
      key: "col",
      min: 100,
      max: 500,
    });
  });

  it("timerange, 1 date → the whole day", () => {
    const day = new Date(2024, 0, 15, 13, 45, 30, 500);
    const op = expectOp(
      normalize(spec("timerange", "timestamp"), day),
      "dateRange",
    );

    expect([
      op.from.getFullYear(),
      op.from.getMonth(),
      op.from.getDate(),
    ]).toEqual([2024, 0, 15]);
    expect([
      op.from.getHours(),
      op.from.getMinutes(),
      op.from.getSeconds(),
      op.from.getMilliseconds(),
    ]).toEqual([0, 0, 0, 0]);

    expect([op.to.getFullYear(), op.to.getMonth(), op.to.getDate()]).toEqual([
      2024, 0, 15,
    ]);
    expect([
      op.to.getHours(),
      op.to.getMinutes(),
      op.to.getSeconds(),
      op.to.getMilliseconds(),
    ]).toEqual([23, 59, 59, 999]);
  });

  it("timerange, 1 date does not mutate the caller's Date", () => {
    const day = new Date(2024, 0, 15, 13, 45, 30, 500);
    const before = day.getTime();
    normalize(spec("timerange", "timestamp"), day);
    expect(day.getTime()).toBe(before);
  });

  it("timerange, 2 dates → dateRange, verbatim (no day expansion)", () => {
    const from = new Date(2024, 0, 15, 13, 45);
    const to = new Date(2024, 0, 20, 9, 30);
    const op = expectOp(
      normalize(spec("timerange", "timestamp"), [from, to]),
      "dateRange",
    );
    expect(op.from.getTime()).toBe(from.getTime());
    expect(op.to.getTime()).toBe(to.getTime());
  });
});

// ── The load-bearing case ───────────────────────────────────────────────────

describe("normalize — a numeric checkbox is a set, never a range", () => {
  it("{ type: 'checkbox', kind: 'number' } with [200, 500] → oneOf", () => {
    // The bug: the old engine dispatched on the runtime shape, saw a 2-element
    // number array, and emitted `WHERE status BETWEEN 200 AND 500` — which
    // matched 201, 301, 404 and 429 as well.
    expect(normalize(spec("checkbox", "number"), [200, 500])).toEqual({
      op: "oneOf",
      key: "col",
      values: [200, 500],
    });
  });

  it("numberRange is UNREACHABLE from a checkbox spec, for every kind and arity", () => {
    // Stated as a property rather than an example: this is what makes
    // `BETWEEN 200 AND 500` unrepresentable, not just unproduced-in-this-case.
    const payloads: unknown[][] = [
      [200],
      [200, 500],
      [200, 404, 500],
      ["200"],
      ["200", "500"],
      ["200", "404", "500"],
      [0],
      [0, 1],
      [0, 1, 2],
      [true],
      [true, false],
      ["error"],
      ["error", "warn"],
      ["error", "warn", "info"],
    ];

    for (const kind of ALL_KINDS) {
      for (const values of payloads) {
        const label = `checkbox/${kind} × ${JSON.stringify(values)}`;
        const op = normalize(spec("checkbox", kind), values);

        // A payload that cannot be coerced to the declared kind yields no op
        // at all (e.g. `[true]` on a number column). What must never happen is
        // a checkbox producing a range.
        if (op === null) continue;
        expect(op.op, label).not.toBe("numberRange");
        // Positively: a checkbox has exactly two reachable ops.
        expect([kind, op.op]).toEqual([
          kind,
          kind === "array" ? "overlaps" : "oneOf",
        ]);
      }
    }
  });

  it("no checkbox arity collapses two selections into a range's endpoints", () => {
    // Arity 2 was the only arity the old corpus never exercised.
    const op = expectOp(
      normalize(spec("checkbox", "number"), [200, 500]),
      "oneOf",
    );
    expect(op.values).toHaveLength(2);
    expect(op.values).toEqual([200, 500]);
    expect(op).not.toHaveProperty("min");
    expect(op).not.toHaveProperty("max");
  });
});

// ── isActive ────────────────────────────────────────────────────────────────

describe("isActive", () => {
  const INACTIVE: Array<[string, unknown]> = [
    ["null", null],
    ["undefined", undefined],
    ["empty string", ""],
    ["empty array", []],
    ["[null]", [null]],
    ["[undefined]", [undefined]],
    ["NaN", Number.NaN],
    ["Invalid Date", new Date("nope")],
  ];

  const ACTIVE: Array<[string, unknown]> = [
    // 0 and false are real, selectable values — treating them as "cleared" is
    // the classic falsy-check bug this function exists to prevent.
    ["0", 0],
    ["false", false],
    ["-0", -0],
    // A single space is a real string; a substring search for " " is legal.
    ["single space", " "],
    ["non-empty string", "a"],
    ["valid Date", new Date(2024, 0, 15)],
    ["[0]", [0]],
    ["[false]", [false]],
    ["[0, 500]", [0, 500]],
    ["object", {}],
  ];

  it.each(INACTIVE)("%s is inactive", (_label, value) => {
    expect(isActive(value)).toBe(false);
  });

  it.each(ACTIVE)("%s is active", (_label, value) => {
    expect(isActive(value)).toBe(true);
  });

  it("an array is active if its non-null entries are all active", () => {
    expect(isActive([null, "fra"])).toBe(true);
    expect(isActive([undefined, 0])).toBe(true);
  });

  it("an array with one usable entry is active", () => {
    // `some`, not `every`: `normalize` drops the members it cannot use, so one
    // blank entry must not delete the whole filter. Requiring every member to
    // be usable was also inconsistent — `["abc", 500]` on a slider degenerated
    // to 500 while `["", 500]` vanished entirely.
    expect(isActive(["", "fra"])).toBe(true);
    expect(isActive([Number.NaN, 500])).toBe(true);
    expect(isActive([new Date("nope"), new Date(2024, 0, 15)])).toBe(true);
    // Still inactive when NO member is usable.
    expect(isActive(["", ""])).toBe(false);
    expect(isActive([Number.NaN])).toBe(false);
  });

  it("nested empty arrays are inactive", () => {
    expect(isActive([[]])).toBe(false);
  });
});

describe("normalize — inactive values produce no op", () => {
  const INACTIVE: Array<[string, unknown]> = [
    ["null", null],
    ["undefined", undefined],
    ["empty string", ""],
    ["empty array", []],
    ["[null]", [null]],
    ["NaN", Number.NaN],
    ["Invalid Date", new Date("nope")],
  ];

  for (const type of ALL_TYPES) {
    for (const kind of ALL_KINDS) {
      it.each(INACTIVE)(`${type}/${kind} + %s → null`, (_label, value) => {
        expect(normalize(spec(type, kind), value)).toBeNull();
      });
    }
  }

  it("0 and false still produce ops — they are values, not absences", () => {
    expect(normalize(spec("checkbox", "number"), [0])).toEqual({
      op: "oneOf",
      key: "col",
      values: [0],
    });
    expect(normalize(spec("checkbox", "boolean"), [false])).toEqual({
      op: "oneOf",
      key: "col",
      values: [false],
    });
    expect(normalize(spec("input", "number"), 0)).toEqual({
      op: "equals",
      key: "col",
      value: 0,
    });
    expect(normalize(spec("slider", "number"), [0, 0])).toEqual({
      op: "numberRange",
      key: "col",
      min: 0,
      max: 0,
    });
  });

  it("a single space is a real substring needle", () => {
    expect(normalize(spec("input", "string"), " ")).toEqual({
      op: "substring",
      key: "col",
      value: " ",
    });
  });
});

// ── Arity normalization ─────────────────────────────────────────────────────

describe("normalize — slider arity", () => {
  it("a bare scalar behaves as a one-handle slider", () => {
    expect(normalize(spec("slider", "number"), 500)).toEqual({
      op: "numberRange",
      key: "col",
      min: 500,
      max: 500,
    });
  });

  it("1 value → [v, v]", () => {
    expect(normalize(spec("slider", "number"), [500])).toEqual({
      op: "numberRange",
      key: "col",
      min: 500,
      max: 500,
    });
  });

  it("2 values → [min, max]", () => {
    expect(normalize(spec("slider", "number"), [100, 500])).toEqual({
      op: "numberRange",
      key: "col",
      min: 100,
      max: 500,
    });
  });

  it("2 reversed values swap", () => {
    expect(normalize(spec("slider", "number"), [500, 100])).toEqual({
      op: "numberRange",
      key: "col",
      min: 100,
      max: 500,
    });
  });

  it("3+ values use the first two and ignore the rest", () => {
    expect(normalize(spec("slider", "number"), [100, 500, 9000])).toEqual({
      op: "numberRange",
      key: "col",
      min: 100,
      max: 500,
    });
    expect(normalize(spec("slider", "number"), [500, 100, 9000])).toEqual({
      op: "numberRange",
      key: "col",
      min: 100,
      max: 500,
    });
  });

  it("negative and fractional bounds survive", () => {
    expect(normalize(spec("slider", "number"), [-2.5, 0.5])).toEqual({
      op: "numberRange",
      key: "col",
      min: -2.5,
      max: 0.5,
    });
  });

  it("uncoercible entries are dropped before arity is decided", () => {
    // [ "abc", 500 ] has arity 2 but only one usable number, so it degenerates
    // to a one-handle range rather than becoming half-undefined.
    expect(normalize(spec("slider", "number"), ["abc", 500])).toEqual({
      op: "numberRange",
      key: "col",
      min: 500,
      max: 500,
    });
  });
});

describe("normalize — timerange arity", () => {
  it("a bare Date expands to the whole day", () => {
    const day = new Date(2024, 5, 3, 8, 0, 0, 0);
    const op = expectOp(
      normalize(spec("timerange", "timestamp"), day),
      "dateRange",
    );
    expect(op.from.getHours()).toBe(0);
    expect(op.to.getHours()).toBe(23);
    expect(op.to.getTime() - op.from.getTime()).toBe(86_399_999);
  });

  it("[date] expands to the whole day", () => {
    const day = new Date(2024, 5, 3, 8, 0, 0, 0);
    const op = expectOp(
      normalize(spec("timerange", "timestamp"), [day]),
      "dateRange",
    );
    expect(op.to.getTime() - op.from.getTime()).toBe(86_399_999);
  });

  it("[from, to] is used verbatim", () => {
    const from = new Date(2024, 5, 3, 8, 0);
    const to = new Date(2024, 5, 4, 16, 0);
    const op = expectOp(
      normalize(spec("timerange", "timestamp"), [from, to]),
      "dateRange",
    );
    expect(op.from.getTime()).toBe(from.getTime());
    expect(op.to.getTime()).toBe(to.getTime());
  });

  it("[to, from] swaps", () => {
    const from = new Date(2024, 5, 3, 8, 0);
    const to = new Date(2024, 5, 4, 16, 0);
    const op = expectOp(
      normalize(spec("timerange", "timestamp"), [to, from]),
      "dateRange",
    );
    expect(op.from.getTime()).toBe(from.getTime());
    expect(op.to.getTime()).toBe(to.getTime());
  });

  it("equal bounds produce a zero-width, still-inclusive range", () => {
    const at = new Date(2024, 5, 3, 8, 0);
    const op = expectOp(
      normalize(spec("timerange", "timestamp"), [at, new Date(at.getTime())]),
      "dateRange",
    );
    expect(op.from.getTime()).toBe(at.getTime());
    expect(op.to.getTime()).toBe(at.getTime());
  });

  it("3+ dates use the first two", () => {
    const a = new Date(2024, 5, 3);
    const b = new Date(2024, 5, 4);
    const c = new Date(2024, 5, 9);
    const op = expectOp(
      normalize(spec("timerange", "timestamp"), [a, b, c]),
      "dateRange",
    );
    expect(op.to.getTime()).toBe(b.getTime());
  });

  it("one uncoercible bound degenerates to a whole-day range on the other", () => {
    const day = new Date(2024, 5, 3, 8, 0);
    const op = expectOp(
      normalize(spec("timerange", "timestamp"), [day, "not-a-date"]),
      "dateRange",
    );
    expect(op.to.getTime() - op.from.getTime()).toBe(86_399_999);
  });
});

// ── Boundary coercion ───────────────────────────────────────────────────────
//
// RFC #87 names four producers of filter values: nuqs (typed), MCP (raw JSON),
// the LLM (strings), superjson (revived Dates). normalize is the only place
// that reconciles them.

describe("normalize — boundary coercion", () => {
  it("input/number accepts a string from the URL or an LLM", () => {
    expect(normalize(spec("input", "number"), "200")).toEqual({
      op: "equals",
      key: "col",
      value: 200,
    });
    expect(normalize(spec("input", "number"), " 200 ")).toEqual({
      op: "equals",
      key: "col",
      value: 200,
    });
    expect(normalize(spec("input", "number"), "-2.5")).toEqual({
      op: "equals",
      key: "col",
      value: -2.5,
    });
  });

  it("input/number unwraps a single-element array (nuqs array parsers)", () => {
    expect(normalize(spec("input", "number"), ["200"])).toEqual({
      op: "equals",
      key: "col",
      value: 200,
    });
  });

  it("input/string stringifies a non-string scalar", () => {
    expect(normalize(spec("input", "string"), 200)).toEqual({
      op: "substring",
      key: "col",
      value: "200",
    });
    expect(normalize(spec("input", "string"), true)).toEqual({
      op: "substring",
      key: "col",
      value: "true",
    });
  });

  it("slider accepts string bounds", () => {
    expect(normalize(spec("slider", "number"), ["200", "500"])).toEqual({
      op: "numberRange",
      key: "col",
      min: 200,
      max: 500,
    });
  });

  it("slider swaps reversed string bounds too", () => {
    expect(normalize(spec("slider", "number"), ["500", "200"])).toEqual({
      op: "numberRange",
      key: "col",
      min: 200,
      max: 500,
    });
  });

  it("timerange accepts ISO strings", () => {
    const fromISO = "2024-01-15T08:30:00.000Z";
    const toISO = "2024-01-20T16:45:00.000Z";
    const op = expectOp(
      normalize(spec("timerange", "timestamp"), [fromISO, toISO]),
      "dateRange",
    );
    expect(op.from.getTime()).toBe(new Date(fromISO).getTime());
    expect(op.to.getTime()).toBe(new Date(toISO).getTime());
  });

  it("timerange accepts epoch millis as numbers", () => {
    const from = Date.UTC(2024, 0, 15, 8, 30);
    const to = Date.UTC(2024, 0, 20, 16, 45);
    const op = expectOp(
      normalize(spec("timerange", "timestamp"), [from, to]),
      "dateRange",
    );
    expect(op.from.getTime()).toBe(from);
    expect(op.to.getTime()).toBe(to);
  });

  it("timerange accepts revived Dates (superjson) unchanged", () => {
    const from = new Date("2024-01-15T08:30:00.000Z");
    const to = new Date("2024-01-20T16:45:00.000Z");
    const op = expectOp(
      normalize(spec("timerange", "timestamp"), [from, to]),
      "dateRange",
    );
    expect(op.from.getTime()).toBe(from.getTime());
    expect(op.to.getTime()).toBe(to.getTime());
  });

  it("timerange accepts a mixed ISO-string / Date pair", () => {
    const from = new Date("2024-01-15T08:30:00.000Z");
    const op = expectOp(
      normalize(spec("timerange", "timestamp"), [
        from,
        "2024-01-20T16:45:00.000Z",
      ]),
      "dateRange",
    );
    expect(op.from.getTime()).toBe(from.getTime());
    expect(op.to.getTime()).toBe(
      new Date("2024-01-20T16:45:00.000Z").getTime(),
    );
  });

  it("accepts epoch millis that arrive as strings", () => {
    // The command palette serializes timeranges with `getTime()`, and JSON has
    // no Date type, so digit strings are a real wire shape. `new Date("17000…")`
    // is an Invalid Date, so this needs the explicit magnitude check.
    expect(
      normalize(spec("timerange", "timestamp"), [
        String(Date.UTC(2024, 0, 15)),
        String(Date.UTC(2024, 0, 20)),
      ]),
    ).toEqual({
      op: "dateRange",
      key: "col",
      from: new Date(Date.UTC(2024, 0, 15)),
      to: new Date(Date.UTC(2024, 0, 20)),
    });
  });

  it("still parses a bare year rather than reading it as epoch millis", () => {
    // The magnitude check is what keeps "2024" a year and not 2024ms.
    const op = normalize(spec("timerange", "timestamp"), ["2024"]);
    expect(op?.op).toBe("dateRange");
    expect((op as { from: Date }).from.getFullYear()).toBe(2024);
  });

  it("coerces checkbox members to the declared kind", () => {
    // A numeric checkbox filtered from a URL arrives as strings. Passing those
    // through handed the SQL backend `inArray(integerColumn, ["200", "500"])`
    // and made `coerce()` return strings for a number column.
    expect(normalize(spec("checkbox", "number"), ["200", "500"])).toEqual({
      op: "oneOf",
      key: "col",
      values: [200, 500],
    });
    expect(normalize(spec("checkbox", "boolean"), ["true"])).toEqual({
      op: "oneOf",
      key: "col",
      values: [true],
    });
    // Members that cannot be coerced are dropped, not passed through.
    expect(normalize(spec("checkbox", "number"), ["200", "abc"])).toEqual({
      op: "oneOf",
      key: "col",
      values: [200],
    });
  });

  it("coerces array-column members against the ITEM kind", () => {
    const arraySpec = {
      ...spec("checkbox", "array"),
      itemKind: "number" as const,
    };
    expect(normalize(arraySpec, ["1", "2"])).toEqual({
      op: "overlaps",
      key: "col",
      values: [1, 2],
    });
  });
});

// ── Totality ────────────────────────────────────────────────────────────────

describe("normalize — total function", () => {
  const HOSTILE: Array<[string, unknown]> = [
    ["non-numeric string", "abc"],
    ["blank string", "   "],
    ["plain object", {}],
    ["nested object", { a: 1 }],
    ["array of objects", [{}, {}]],
    ["function", () => undefined],
    ["symbol", Symbol("s")],
    // BigInt(10), not `10n` — the package targets ES2017.
    ["bigint", BigInt(10)],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["array of arrays", [[1], [2]]],
    ["Map", new Map()],
    ["date-shaped garbage", "2024-13-45T99:99:99Z"],
  ];

  for (const type of ALL_TYPES) {
    for (const kind of ALL_KINDS) {
      it.each(HOSTILE)(
        `${type}/${kind} + %s returns an op or null, never throws`,
        (_label, value) => {
          const run = () => normalize(spec(type, kind), value);
          expect(run).not.toThrow();
          const op = run();
          if (op !== null) {
            expect([
              "substring",
              "equals",
              "oneOf",
              "overlaps",
              "numberRange",
              "dateRange",
            ]).toContain(op.op);
            expect(op.key).toBe("col");
          }
        },
      );
    }
  }

  it("uncoercible numeric input returns null rather than NaN", () => {
    expect(normalize(spec("input", "number"), "abc")).toBeNull();
    expect(normalize(spec("input", "number"), "   ")).toBeNull();
    expect(normalize(spec("input", "number"), {})).toBeNull();
  });

  it("uncoercible slider bounds return null", () => {
    expect(normalize(spec("slider", "number"), ["abc"])).toBeNull();
    expect(normalize(spec("slider", "number"), ["abc", "def"])).toBeNull();
    expect(normalize(spec("slider", "number"), [{}])).toBeNull();
  });

  it("uncoercible dates return null", () => {
    expect(normalize(spec("timerange", "timestamp"), ["nope"])).toBeNull();
    expect(normalize(spec("timerange", "timestamp"), [{}])).toBeNull();
    expect(normalize(spec("timerange", "timestamp"), [true, false])).toBeNull();
  });

  it("uncoercible checkbox members return null once none survive", () => {
    expect(normalize(spec("checkbox", "enum"), [{}, {}])).toBeNull();
    expect(normalize(spec("checkbox", "array"), [{}])).toBeNull();
  });

  it("a checkbox keeps only the coercible members", () => {
    expect(normalize(spec("checkbox", "enum"), ["error", {}])).toEqual({
      op: "oneOf",
      key: "col",
      values: ["error"],
    });
  });

  it("the emitted key is always the spec's key, never derived from the value", () => {
    expect(
      normalize({ key: "timing.dns", type: "slider", kind: "number" }, [1, 2]),
    ).toEqual({ op: "numberRange", key: "timing.dns", min: 1, max: 2 });
    expect(
      normalize({ key: "timing.dns", type: "input", kind: "string" }, "x"),
    ).toEqual({ op: "substring", key: "timing.dns", value: "x" });
  });
});

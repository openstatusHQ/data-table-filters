import { describe, expect, it } from "vitest";
import { col } from "../../table-schema/col";
import type {
  ColBuilder,
  ColKind,
  FilterType,
  TableSchemaDefinition,
} from "../../table-schema/types";
import { defineFilters } from "../index";
import { normalize } from "../normalize";
import type { FilterOp, FilterSpec, Scalar } from "../types";

/**
 * The conformance corpus: one schema, one set of rows, one set of cases, and a
 * runner that any engine can be pointed at.
 *
 * ## The oracle is hand-written
 *
 * Every case carries `expect: number[]` — row ids typed out by a human reading
 * `conformanceRows`. It is deliberately NOT computed by the in-memory engine.
 * If the in-memory engine were the oracle, a bug in it would silently become
 * the specification and every other engine would be "conformant" with the wrong
 * answer. That is precisely the failure this corpus exists to end: the old
 * corpus exercised `status` as a scalar, a 1-element array, and a 3-element
 * array, but never 2 — stepping around the one arity that was broken.
 *
 * When you add a case, work out the expected ids by reading the rows. Do not
 * run an engine and paste its output.
 */

// ── The schema ──────────────────────────────────────────────────────────────

const LEVELS = ["error", "warn", "info", "debug"] as const;
const REGIONS = ["ams", "fra", "gru", "iad"] as const;

/**
 * One column per `(ColKind, FilterType)` pair that `ColBuilder` permits, plus
 * the two kinds that permit none.
 *
 * Keys are flat on purpose. A SQL engine consuming this corpus has to map every
 * key to a real column, and dot-notation keys would make that mapping a second
 * thing to get wrong. Dotted-key resolution is `getValueAtKey`'s contract and is
 * tested where that function lives.
 */
export const conformanceSchema: TableSchemaDefinition = {
  // Not filterable — the row identity the whole corpus is keyed by.
  id: col.number().label("ID").notFilterable(),

  // string × input → substring (case-INsensitive)
  name: col.string().label("Name").filterable("input"),

  // number × checkbox → oneOf. THE column the shipping bug lived in.
  status: col
    .number()
    .label("Status")
    .filterable("checkbox", {
      options: [200, 201, 301, 404, 429, 500].map((v) => ({
        label: String(v),
        value: v,
      })),
    }),

  // number × input → equals (NOT a substring match on a stringified number)
  port: col.number().label("Port").filterable("input"),

  // number × slider → numberRange
  latency: col
    .number()
    .label("Latency")
    .filterable("slider", { min: 0, max: 5000 }),

  // boolean × checkbox → oneOf
  active: col.boolean().label("Active").filterable("checkbox"),

  // enum × checkbox → oneOf
  level: col.enum(LEVELS).label("Level").filterable("checkbox"),

  // array × checkbox → overlaps
  regions: col
    .array(col.enum(REGIONS))
    .label("Regions")
    .filterable("checkbox", {
      options: REGIONS.map((r) => ({ label: r, value: r })),
    }),

  // timestamp × timerange → dateRange
  createdAt: col.timestamp().label("Created At").filterable("timerange"),

  // record → not filterable at all (`F = never`)
  headers: col.record().label("Headers"),
};

// ── The rows ────────────────────────────────────────────────────────────────

export type ConformanceRow = {
  id: number;
  name: string;
  status: number;
  port: number;
  latency: number;
  active: boolean;
  level: (typeof LEVELS)[number];
  regions: (typeof REGIONS)[number][];
  createdAt: Date;
  headers: Record<string, string>;
};

/**
 * A local-time instant in January 2024.
 *
 * Local, not UTC: `normalize` computes a single-date timerange's day boundaries
 * with `setHours`, so authoring the rows in local time keeps the whole-day cases
 * timezone-independent for any runtime that evaluates them in JS. An engine that
 * stores UTC may legitimately disagree — that is what the `"utc-ms"` corpus
 * divergence declares.
 */
function jan(day: number, hour = 0, minute = 0): Date {
  return new Date(2024, 0, day, hour, minute, 0, 0);
}

/**
 * Eight rows, hand-authored.
 *
 * `status` mirrors the seed data exactly — `200, 201, 301, 500, 404, 200, 429,
 * 200` — because the shipping bug is only visible against those values:
 * `BETWEEN 200 AND 500` swallows 201, 301, 404 and 429 too.
 *
 * `name` mixes case (row 2) so a case-insensitive match has something to prove.
 * `port` holds both `5` and `1500` so an exact match has something to prove.
 * `regions` puts the interesting member at index 1 on rows 3, 6 and 7 so an
 * overlap has something to prove, and row 4 is empty so it can never match.
 */
export const conformanceRows: readonly ConformanceRow[] = [
  {
    id: 1,
    name: "alpha.example.com",
    status: 200,
    port: 443,
    latency: 100,
    active: true,
    level: "error",
    regions: ["ams", "fra"],
    createdAt: jan(1, 0, 0),
    headers: { "content-type": "text/html" },
  },
  {
    id: 2,
    name: "BETA.EXAMPLE.com",
    status: 201,
    port: 80,
    latency: 250,
    active: false,
    level: "warn",
    regions: ["fra"],
    createdAt: jan(1, 23, 59),
    headers: { "content-type": "application/json" },
  },
  {
    id: 3,
    name: "gamma.example.com",
    status: 301,
    port: 8080,
    latency: 500,
    active: true,
    level: "info",
    regions: ["gru", "ams"],
    createdAt: jan(2, 8, 0),
    headers: { location: "/moved" },
  },
  {
    id: 4,
    name: "delta.example.com",
    status: 500,
    port: 443,
    latency: 1500,
    active: false,
    level: "error",
    regions: [],
    createdAt: jan(3, 12, 0),
    headers: {},
  },
  {
    id: 5,
    name: "epsilon.test.org",
    status: 404,
    port: 5,
    latency: 2500,
    active: true,
    level: "debug",
    regions: ["iad"],
    createdAt: jan(4, 0, 0),
    headers: { "cache-control": "no-store" },
  },
  {
    id: 6,
    name: "zeta.example.com",
    status: 200,
    port: 1500,
    latency: 3000,
    active: false,
    level: "warn",
    regions: ["ams", "iad"],
    createdAt: jan(5, 9, 30),
    headers: { "content-type": "text/plain" },
  },
  {
    id: 7,
    name: "eta.test.org",
    status: 429,
    port: 443,
    latency: 4000,
    active: true,
    level: "info",
    regions: ["fra", "gru"],
    createdAt: jan(6, 0, 0),
    headers: { "retry-after": "30" },
  },
  {
    id: 8,
    name: "theta.example.com",
    status: 200,
    port: 22,
    latency: 5000,
    active: false,
    level: "debug",
    regions: ["gru"],
    createdAt: jan(7, 18, 45),
    headers: { "content-type": "text/html" },
  },
];

/** Every row id, in order. The expected result of any inactive filter. */
const ALL_IDS = conformanceRows.map((row) => row.id);

// ── Declared corpus divergences ─────────────────────────────────────────────

/**
 * The only reasons an engine may decline a case.
 *
 * A divergence is a property of the *corpus*, not of the engine: it marks a case
 * whose expected answer depends on a semantic the corpus resolves in JS (local
 * timezone, IEEE-754 doubles, ASCII collation) and which a different substrate
 * may resolve differently for defensible reasons. It is not a place to park a
 * bug — an untagged case that an engine declares no support for is a hard
 * failure, see {@link runConformance}.
 */
export type CorpusDivergence =
  | "ascii"
  | "ascii-ci"
  | "finite-number"
  | "utc-ms";

const DIVERGENCE_REASONS: Record<CorpusDivergence, string> = {
  ascii:
    "expected ids depend on ASCII ordering/collation; an engine with a locale-aware collation may order or compare differently",
  "ascii-ci":
    "expected ids depend on ASCII case folding; an engine whose case-insensitive match is locale- or Unicode-aware may fold differently",
  "finite-number":
    "expected ids depend on IEEE-754 double semantics; an engine with a narrower or exact numeric domain may compare differently",
  "utc-ms":
    "expected ids depend on date semantics resolved in the runtime's local timezone at millisecond precision; an engine storing UTC or truncating precision may resolve day boundaries differently",
};

// ── The cases ───────────────────────────────────────────────────────────────

export type ConformanceCase = {
  /** Stable identifier. Appears in the test name and in failure output. */
  id: string;
  /** The column key being filtered. */
  key: string;
  /** The raw filter value, exactly as a URL / MCP / UI layer would hand it over. */
  value: unknown;
  /** Row ids expected back. HAND-WRITTEN. Never computed by an engine. */
  expect: number[];
  /** Declared divergence, if this case's answer is substrate-dependent. */
  corpus?: CorpusDivergence;
};

export const conformanceCases: readonly ConformanceCase[] = [
  // ── number × checkbox → oneOf ────────────────────────────────────────────
  {
    // THE case. Two values, which is the arity the old length-based dispatch
    // turned into `BETWEEN 200 AND 500`, returning all eight rows.
    id: "status/two-values-the-shipping-bug",
    key: "status",
    value: [200, 500],
    expect: [1, 4, 6, 8],
  },
  {
    // Same shape, bounds chosen so a range answer is maximally wrong: a
    // `BETWEEN 201 AND 429` would also drag in 301 and 404.
    id: "status/two-values-with-populated-interior",
    key: "status",
    value: [201, 429],
    expect: [2, 7],
  },
  {
    id: "status/one-value",
    key: "status",
    value: [200],
    expect: [1, 6, 8],
  },
  {
    id: "status/three-values",
    key: "status",
    value: [200, 404, 500],
    expect: [1, 4, 5, 6, 8],
  },
  {
    id: "status/bare-scalar",
    key: "status",
    value: 200,
    expect: [1, 6, 8],
  },
  {
    // The URL layer can only produce strings.
    id: "status/two-values-as-strings",
    key: "status",
    value: ["200", "500"],
    expect: [1, 4, 6, 8],
  },
  {
    id: "status/no-match",
    key: "status",
    value: [999],
    expect: [],
  },
  {
    id: "status/inactive-empty-array",
    key: "status",
    value: [],
    expect: ALL_IDS,
  },
  {
    id: "status/inactive-null",
    key: "status",
    value: null,
    expect: ALL_IDS,
  },

  // ── number × slider → numberRange ────────────────────────────────────────
  {
    // One handle is a degenerate range, not an equality.
    id: "slider/one-value-is-a-degenerate-range",
    key: "latency",
    value: [500],
    expect: [3],
  },
  {
    // Inclusive on both ends: 250 and 2500 are themselves row values.
    id: "slider/two-values-inclusive-both-ends",
    key: "latency",
    value: [250, 2500],
    expect: [2, 3, 4, 5],
  },
  {
    // Handles beyond the first two are ignored — the range is still [250, 2500].
    id: "slider/three-values-uses-first-two",
    key: "latency",
    value: [250, 2500, 4000],
    expect: [2, 3, 4, 5],
  },
  {
    id: "slider/reversed-bounds-normalize",
    key: "latency",
    value: [2500, 250],
    expect: [2, 3, 4, 5],
  },
  {
    id: "slider/bare-scalar",
    key: "latency",
    value: 3000,
    expect: [6],
  },
  {
    id: "slider/values-as-strings",
    key: "latency",
    value: ["100", "500"],
    expect: [1, 2, 3],
  },
  {
    id: "slider/inactive-nan",
    key: "latency",
    value: NaN,
    expect: ALL_IDS,
  },

  // ── number × input → equals ──────────────────────────────────────────────
  {
    // The whole point: 5 must not substring-match 1500 (row 6).
    id: "input-number/exact-not-substring",
    key: "port",
    value: 5,
    expect: [5],
  },
  {
    // …nor prefix-match 8080 (row 3).
    id: "input-number/exact-not-prefix",
    key: "port",
    value: 80,
    expect: [2],
  },
  {
    id: "input-number/matches-every-equal-row",
    key: "port",
    value: 443,
    expect: [1, 4, 7],
  },
  {
    id: "input-number/value-as-string",
    key: "port",
    value: "443",
    expect: [1, 4, 7],
  },
  {
    id: "input-number/inactive-empty-string",
    key: "port",
    value: "",
    expect: ALL_IDS,
  },

  // ── string × input → substring (case-insensitive) ────────────────────────
  {
    // Row 2's cell is "BETA.EXAMPLE.com" — it matches a lowercase needle.
    id: "input-string/substring-case-insensitive",
    key: "name",
    value: "example",
    expect: [1, 2, 3, 4, 6, 8],
    corpus: "ascii-ci",
  },
  {
    // The other direction: uppercase needle, lowercase cells.
    id: "input-string/uppercase-needle-lowercase-cells",
    key: "name",
    value: "TEST.ORG",
    expect: [5, 7],
    corpus: "ascii-ci",
  },
  {
    // The differing-case match, isolated to a single row.
    id: "input-string/differing-case-single-match",
    key: "name",
    value: "beta",
    expect: [2],
    corpus: "ascii-ci",
  },
  {
    // A real substring, not a prefix: "BETA.", "zeta.", "eta.", "theta." all
    // contain it. "delta." does not — it ends "lta.".
    id: "input-string/matches-mid-token-not-just-prefix",
    key: "name",
    value: "eta.",
    expect: [2, 6, 7, 8],
  },
  {
    id: "input-string/no-match",
    key: "name",
    value: "zzz",
    expect: [],
  },
  {
    id: "input-string/inactive-empty-string",
    key: "name",
    value: "",
    expect: ALL_IDS,
  },

  // ── boolean × checkbox → oneOf ───────────────────────────────────────────
  {
    id: "checkbox-boolean/true",
    key: "active",
    value: [true],
    expect: [1, 3, 5, 7],
  },
  {
    id: "checkbox-boolean/false",
    key: "active",
    value: [false],
    expect: [2, 4, 6, 8],
  },
  {
    id: "checkbox-boolean/both",
    key: "active",
    value: [true, false],
    expect: ALL_IDS,
  },
  {
    id: "checkbox-boolean/value-as-string",
    key: "active",
    value: ["true"],
    expect: [1, 3, 5, 7],
  },

  // ── enum × checkbox → oneOf ──────────────────────────────────────────────
  {
    id: "checkbox-enum/one-value",
    key: "level",
    value: ["error"],
    expect: [1, 4],
  },
  {
    id: "checkbox-enum/two-values",
    key: "level",
    value: ["error", "debug"],
    expect: [1, 4, 5, 8],
  },
  {
    id: "checkbox-enum/member-not-in-the-data",
    key: "level",
    value: ["nope"],
    expect: [],
  },
  {
    id: "checkbox-enum/inactive-undefined",
    key: "level",
    value: undefined,
    expect: ALL_IDS,
  },

  // ── array × checkbox → overlaps ──────────────────────────────────────────
  {
    // The `regions` bug: row 3 holds ["gru","ams"], so "ams" is at index 1.
    // Comparing only `row[key][0]` misses it.
    id: "checkbox-array/match-is-not-the-first-element",
    key: "regions",
    value: ["ams"],
    expect: [1, 3, 6],
  },
  {
    // Row 6 holds ["ams","iad"] — again index 1.
    id: "checkbox-array/second-element-only",
    key: "regions",
    value: ["iad"],
    expect: [5, 6],
  },
  {
    id: "checkbox-array/two-values-overlap",
    key: "regions",
    value: ["gru", "iad"],
    expect: [3, 5, 6, 7, 8],
  },
  {
    // Row 4's cell is [] and must never match.
    id: "checkbox-array/empty-cell-never-matches",
    key: "regions",
    value: ["fra"],
    expect: [1, 2, 7],
  },
  {
    id: "checkbox-array/no-match",
    key: "regions",
    value: ["nowhere"],
    expect: [],
  },
  {
    id: "checkbox-array/inactive-empty-array",
    key: "regions",
    value: [],
    expect: ALL_IDS,
  },

  // ── timestamp × timerange → dateRange ────────────────────────────────────
  {
    // One date means that whole day: row 1 sits on the opening boundary
    // (00:00:00.000) and row 2 one minute short of the closing one.
    id: "timerange/single-date-covers-the-whole-day",
    key: "createdAt",
    value: [jan(1, 13, 0)],
    expect: [1, 2],
    corpus: "utc-ms",
  },
  {
    id: "timerange/bare-single-date-covers-the-whole-day",
    key: "createdAt",
    value: jan(7),
    expect: [8],
    corpus: "utc-ms",
  },
  {
    // Inclusive on both ends: `from` is row 3's instant exactly, `to` is row 5's.
    id: "timerange/two-dates-inclusive-both-ends",
    key: "createdAt",
    value: [jan(2, 8, 0), jan(4, 0, 0)],
    expect: [3, 4, 5],
  },
  {
    id: "timerange/reversed-bounds-normalize",
    key: "createdAt",
    value: [jan(4, 0, 0), jan(2, 8, 0)],
    expect: [3, 4, 5],
  },
  {
    // MCP args and LLM output arrive as ISO strings, not Dates. An ISO
    // date-time without a zone designator is local time, matching `jan()`.
    id: "timerange/two-dates-as-iso-strings",
    key: "createdAt",
    value: ["2024-01-02T08:00:00", "2024-01-04T00:00:00"],
    expect: [3, 4, 5],
    corpus: "utc-ms",
  },
  {
    id: "timerange/no-match",
    key: "createdAt",
    value: [jan(20)],
    expect: [],
  },
  {
    id: "timerange/inactive-invalid-date",
    key: "createdAt",
    value: new Date("nope"),
    expect: ALL_IDS,
  },
  {
    id: "timerange/inactive-null",
    key: "createdAt",
    value: null,
    expect: ALL_IDS,
  },

  // ── record → no filter exists ────────────────────────────────────────────
  {
    // `col.record()` is `F = never`, so no spec is produced and a value handed
    // in under that key is not a filter at all.
    id: "record/not-filterable-so-nothing-is-filtered",
    key: "headers",
    value: { "content-type": "text/html" },
    expect: ALL_IDS,
  },
];

// ── What the corpus reaches, derived ────────────────────────────────────────

const corpusFilters = defineFilters(conformanceSchema);
const corpusSpecs = corpusFilters.specs;

type Pair = `${ColKind}:${FilterType}`;

function pairOf(spec: FilterSpec): Pair {
  return `${spec.kind}:${spec.type}`;
}

/**
 * The `(kind, type)` pairs the conformance schema actually declares.
 *
 * Derived from the schema, never hardcoded — the coverage test compares this
 * against the cases, and separately against the compile-time upper bound below.
 */
const REACHABLE_PAIRS: readonly Pair[] = Array.from(
  new Set(corpusSpecs.map(pairOf)),
);

/**
 * A scalar of the right shape for a column kind.
 *
 * Kind-aware because `normalize` may reject a scalar that cannot be the
 * declared kind — a number column given `"probe"` coerces to nothing.
 */
function scalarProbeForKind(kind: ColKind): Scalar {
  switch (kind) {
    case "number":
      return 1;
    case "boolean":
      return true;
    default:
      return "probe";
  }
}

/**
 * A value guaranteed to normalize for this spec, used only to ask a column
 * "which op are you?".
 *
 * Exhaustive over `FilterType` with no default: a fifth filter type fails to
 * compile here.
 */
function probeValueFor(spec: FilterSpec): unknown {
  switch (spec.type) {
    case "input":
      return scalarProbeForKind(spec.kind);
    case "checkbox":
      // An array column's members are of its `itemKind`, not of `"array"`.
      return [scalarProbeForKind(spec.itemKind ?? spec.kind)];
    case "slider":
      return [0, 1];
    case "timerange":
      return [new Date(0), new Date(1000)];
  }
}

/** The single op a declared column can emit. */
function opOfSpec(spec: FilterSpec): FilterOp["op"] {
  const op = normalize(spec, probeValueFor(spec));
  if (!op) {
    throw new Error(
      `conformance corpus is broken: spec "${spec.key}" (${pairOf(spec)}) normalized nothing for its probe value`,
    );
  }
  return op.op;
}

/** The ops reachable from the conformance schema. Derived, never hardcoded. */
const REACHABLE_OPS: ReadonlySet<FilterOp["op"]> = new Set(
  corpusSpecs.map(opOfSpec),
);

/**
 * The op a case exercises, or `null` when the case's key has no filter at all
 * (the `record` column).
 */
function opOfCase(testCase: ConformanceCase): FilterOp["op"] | null {
  const spec = corpusFilters.spec(testCase.key);
  return spec ? opOfSpec(spec) : null;
}

// ── The compile-time upper bound: what ColBuilder permits ───────────────────

type FilterTypesOf<B> =
  B extends ColBuilder<infer _T, infer F extends FilterType> ? F : never;

/**
 * Which `col.*` factory produces each kind.
 *
 * `satisfies Record<ColKind, ...>` is the gate: adding a ninth `ColKind` fails
 * to compile until it is listed here, which in turn widens `PermittedPair` and
 * fails `PERMITTED_PAIRS` until the corpus grows a column for it.
 */
const FACTORY_FOR_KIND = {
  string: "string",
  number: "number",
  boolean: "boolean",
  timestamp: "timestamp",
  enum: "enum",
  array: "array",
  record: "record",
  select: "select",
} as const satisfies Record<ColKind, keyof typeof col>;

/**
 * Every `(kind, type)` pair reachable through `ColBuilder`'s overloads.
 *
 * Kinds whose builder has `F = never` (`record`, `select`) contribute nothing,
 * because `` `record:${never}` `` is `never`.
 */
type PermittedPair = {
  [K in ColKind]: `${K}:${FilterTypesOf<
    ReturnType<(typeof col)[(typeof FACTORY_FOR_KIND)[K]]>
  >}`;
}[ColKind];

const PERMITTED_PAIRS = [
  "string:input",
  "number:input",
  "number:slider",
  "number:checkbox",
  "boolean:checkbox",
  "timestamp:timerange",
  "enum:checkbox",
  "array:checkbox",
] as const satisfies readonly PermittedPair[];

type MissingPairs = Exclude<PermittedPair, (typeof PERMITTED_PAIRS)[number]>;
type ExtraPairs = Exclude<(typeof PERMITTED_PAIRS)[number], PermittedPair>;

/**
 * @internal Compile-time, both directions: `PERMITTED_PAIRS` must list exactly
 * the pairs `ColBuilder` permits. Widening a factory's `F` — say allowing
 * `col.string().filterable("checkbox")` — breaks this line, and fixing it
 * forces `conformanceSchema` and `conformanceCases` to grow to match.
 *
 * Exported only so it is not an unused local.
 */
export const _permittedPairsAreExhaustive: [MissingPairs | ExtraPairs] extends [
  never,
]
  ? true
  : {
      PERMITTED_PAIRS_is_out_of_date: MissingPairs | ExtraPairs;
    } = true;

/**
 * Exhaustive over `FilterType`. A fifth member fails to compile here, and the
 * coverage test then requires a column and a case for it.
 */
const ALL_FILTER_TYPES = {
  input: true,
  checkbox: true,
  slider: true,
  timerange: true,
} as const satisfies Record<FilterType, true>;

/** Exhaustive over `FilterOp`. A seventh op fails to compile here. */
const ALL_OPS = {
  substring: true,
  equals: true,
  oneOf: true,
  overlaps: true,
  numberRange: true,
  dateRange: true,
} as const satisfies Record<FilterOp["op"], true>;

// ── Rendering ───────────────────────────────────────────────────────────────

function renderValue(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? "Date(Invalid)"
      : `Date(${value.toISOString()})`;
  }
  if (Array.isArray(value)) return `[${value.map(renderValue).join(", ")}]`;
  if (typeof value === "number" && Number.isNaN(value)) return "NaN";
  if (typeof value === "object") return JSON.stringify(value);
  return typeof value === "string" ? JSON.stringify(value) : String(value);
}

function sortedIds(ids: readonly number[]): number[] {
  return [...ids].sort((a, b) => a - b);
}

// ── The runner ──────────────────────────────────────────────────────────────

export type ConformanceOptions = {
  /** Engine name, used in the describe block. */
  engine: string;
  /**
   * Run one case and return the ids of the rows that survived, in any order.
   * May be async so a SQL-backed engine can await a query.
   */
  select: (testCase: ConformanceCase) => number[] | Promise<number[]>;
  /**
   * Optional capability declaration. Returning `false` for a case whose op is
   * reachable from `conformanceSchema` is a HARD FAILURE unless the case
   * declares a `corpus` divergence — see the note in {@link runConformance}.
   */
  supports?: (testCase: ConformanceCase) => boolean;
};

/**
 * Run the whole corpus against one engine.
 *
 * ## Capability honesty
 *
 * `supports` exists so an engine can decline a case, but it is deliberately not
 * an escape hatch. If it returns `false` for a case whose op the conformance
 * schema can reach — which is every op, since the schema covers all six — the
 * runner emits a failing test rather than a skip. The only permitted decline is
 * a case tagged with a `corpus` divergence, and that skip prints the reason.
 *
 * Otherwise a capability declaration becomes exactly the place a bug goes to
 * hide, which is the failure mode this corpus was written to end.
 */
export function runConformance(options: ConformanceOptions): void {
  const { engine, select, supports } = options;

  describe(`conformance corpus invariants (checked via ${engine})`, () => {
    it("every case's expected ids are real, unique, and ordered", () => {
      const known = new Set(ALL_IDS);
      for (const testCase of conformanceCases) {
        expect(
          testCase.expect,
          `case "${testCase.id}" expects ids not present in conformanceRows`,
        ).toEqual(testCase.expect.filter((id) => known.has(id)));
        expect(
          new Set(testCase.expect).size,
          `case "${testCase.id}" repeats an expected id`,
        ).toBe(testCase.expect.length);
        expect(
          testCase.expect,
          `case "${testCase.id}" expects ids out of order — keep them ascending so the oracle stays readable`,
        ).toEqual(sortedIds(testCase.expect));
      }
    });

    it("every case id is unique", () => {
      const ids = conformanceCases.map((testCase) => testCase.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("every case targets a key the conformance schema declares", () => {
      const keys = new Set(Object.keys(conformanceSchema));
      for (const testCase of conformanceCases) {
        expect(
          keys.has(testCase.key),
          `case "${testCase.id}" targets unknown key "${testCase.key}"`,
        ).toBe(true);
      }
    });

    it("the schema declares exactly the (kind, type) pairs ColBuilder permits", () => {
      // REACHABLE_PAIRS is derived from the schema; PERMITTED_PAIRS is pinned to
      // ColBuilder's overloads at compile time. Adding an overload therefore
      // fails the build, and adding it to PERMITTED_PAIRS then fails this test
      // until the schema grows a column.
      expect(sortedPairs(REACHABLE_PAIRS)).toEqual(
        sortedPairs(PERMITTED_PAIRS),
      );
    });

    it("every (kind, type) pair reachable from the schema has at least one case", () => {
      const covered = new Set<Pair>();
      for (const testCase of conformanceCases) {
        const spec = corpusFilters.spec(testCase.key);
        if (spec) covered.add(pairOf(spec));
      }
      const uncovered = REACHABLE_PAIRS.filter((pair) => !covered.has(pair));
      expect(
        uncovered,
        `no conformance case exercises ${uncovered.join(", ")}`,
      ).toEqual([]);
    });

    it("every FilterType is declared by the schema and exercised by a case", () => {
      const declared = new Set(corpusSpecs.map((spec) => spec.type));
      const exercised = new Set(
        conformanceCases
          .map((testCase) => corpusFilters.spec(testCase.key)?.type)
          .filter((type): type is FilterType => type !== undefined),
      );
      for (const type of Object.keys(ALL_FILTER_TYPES) as FilterType[]) {
        expect(
          declared.has(type),
          `conformanceSchema has no column with filter type "${type}"`,
        ).toBe(true);
        expect(
          exercised.has(type),
          `no conformance case exercises filter type "${type}"`,
        ).toBe(true);
      }
    });

    it("every FilterOp member is produced by at least one case", () => {
      const produced = new Set<FilterOp["op"]>();
      for (const testCase of conformanceCases) {
        const op = opOfCase(testCase);
        if (op) produced.add(op);
      }
      for (const op of Object.keys(ALL_OPS) as FilterOp["op"][]) {
        expect(
          produced.has(op),
          `no conformance case produces the "${op}" op`,
        ).toBe(true);
      }
    });

    it("the numeric checkbox two-value case is present and is not a range", () => {
      // The regression this whole module exists for. Pinned by id so it cannot
      // be quietly deleted or softened into a one- or three-value case.
      const testCase = conformanceCases.find(
        (candidate) => candidate.id === "status/two-values-the-shipping-bug",
      );
      expect(testCase).toBeDefined();
      expect(testCase!.value).toEqual([200, 500]);
      expect(testCase!.expect).toEqual([1, 4, 6, 8]);
      const op = normalize(corpusFilters.spec("status")!, testCase!.value);
      expect(op?.op).toBe("oneOf");
    });
  });

  describe(`conformance — ${engine}`, () => {
    for (const testCase of conformanceCases) {
      const title = `${testCase.id} — ${testCase.key} ← ${renderValue(testCase.value)}`;

      if (supports && !supports(testCase)) {
        const op = opOfCase(testCase);
        const reachable = op === null || REACHABLE_OPS.has(op);

        if (reachable && !testCase.corpus) {
          it(`${title} — CAPABILITY GAP`, () => {
            throw new Error(
              [
                `Engine "${engine}" declares no support for case "${testCase.id}".`,
                `Its op is "${op ?? "none (column is not filterable)"}", which IS reachable from conformanceSchema.`,
                "A capability declaration is not a place to hide a bug: either fix the engine,",
                'or declare a corpus divergence on the case (`corpus: "ascii" | "ascii-ci" | "finite-number" | "utc-ms"`)',
                "and say why in the RFC.",
              ].join("\n"),
            );
          });
          continue;
        }

        const reason = testCase.corpus
          ? DIVERGENCE_REASONS[testCase.corpus]
          : `op "${op ?? "none"}" is not reachable from conformanceSchema`;
        it.skip(`${title} — SKIPPED (declared corpus divergence "${testCase.corpus ?? "n/a"}": ${reason})`, () => {});
        continue;
      }

      it(title, async () => {
        const actual = await select(testCase);
        // Order-independent: no engine promises a row order without an ORDER BY.
        expect(
          sortedIds(actual),
          `case "${testCase.id}" — ${testCase.key} ← ${renderValue(testCase.value)}`,
        ).toEqual(sortedIds(testCase.expect));
      });
    }
  });
}

function sortedPairs(pairs: readonly string[]): string[] {
  return [...pairs].sort();
}

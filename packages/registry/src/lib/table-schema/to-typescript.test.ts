import { describe, expect, it } from "vitest";
import { col, createTableSchema, resolveColumn } from "./index";
import { inferSchemaFromJSON } from "./infer";
import { EMIT_ORDER, schemaToTypeScript } from "./to-typescript";
import type {
  ColumnDescriptor,
  ColumnDescriptorCommon,
  Provenance,
  SchemaJSON,
} from "./types";

// ── The round-trip law ──────────────────────────────────────────────────────
//
// `schemaToTypeScript` emits a `col.*` chain. The only assertion that proves the
// chain is *right* is running it: rebuild a schema from the emitted source and
// check it serializes back to the descriptor it came from.
//
//     rebuild(schema.toJSON()).toJSON()  ≡  schema.toJSON()
//
// `toContain()` on the emitted string cannot catch a chain that does not
// compile (`col.array()` with no item builder) or a chain step that was never
// emitted at all (`.hideHeader()`, `.resizable()`, `.sheetOnly()`) — both of
// which shipped under the previous suite.

type Rebuilt = { toJSON(): SchemaJSON };

/**
 * Evaluate the emitted source and hand back the `schema` it defines.
 *
 * The emitted chain is plain JavaScript — no type annotations — so this needs
 * no compiler, only the two identifiers the source references. The `import` and
 * `export` lines are module syntax and are stripped before evaluation.
 */
function rebuild(json: SchemaJSON): Rebuilt {
  const body = schemaToTypeScript(json)
    .replace(/^import .*\n/, "")
    .replace(/^export /m, "");
  const factory = new Function(
    "col",
    "createTableSchema",
    `${body}; return schema;`,
  ) as (c: typeof col, cts: typeof createTableSchema) => Rebuilt;
  return factory(col, createTableSchema);
}

/** The law, as an assertion. */
function expectRoundTrip(json: SchemaJSON): void {
  expect(rebuild(json).toJSON()).toEqual(json);
}

/**
 * The one field the round trip legitimately cannot preserve.
 *
 * `provenance: { source: "inferred" }` records that a heuristic in `infer.ts`
 * produced the column. Once the emitted source exists, the column is
 * hand-written code, so it comes back as `manual`. Preset provenance IS
 * preserved (it is what selects `col.presets.*` over the raw factory) and is
 * never normalized here.
 */
function asManualProvenance(c: ColumnDescriptor): ColumnDescriptor {
  const provenance: Provenance =
    c.provenance.source === "inferred" ? { source: "manual" } : c.provenance;
  return c.kind === "array"
    ? { ...c, provenance, arrayItem: asManualProvenance(c.arrayItem) }
    : { ...c, provenance };
}

/** The law for inferred schemas: exact, modulo inferred→manual provenance. */
function expectInferredRoundTrip(json: SchemaJSON): void {
  expect(rebuild(json).toJSON()).toEqual({
    ...json,
    columns: json.columns.map((c) => ({
      ...asManualProvenance(c),
      key: c.key,
    })),
  });
}

// ── Fixtures ────────────────────────────────────────────────────────────────

const LEVELS = ["error", "warn", "info"] as const;
const METHODS = ["GET", "POST", "PUT", "DELETE"] as const;
const REGIONS = ["ams", "gru", "hkg", "iad", "fra"] as const;

/**
 * Twelve realistic log rows. Twelve because several inference rules only fire
 * above the ten-distinct-value enum threshold, and the emitter handles those
 * columns differently (`string` vs `enum`, `array(string)` vs `array(enum)`).
 */
const LOG_ROWS = Array.from({ length: 12 }, (_, i) => ({
  // 12 distinct values → `string`, not `enum`; "id" word → code display
  id: `req_${i}`,
  // ISO 8601 string → timestamp
  createdAt: new Date(Date.UTC(2024, 2, 1, 0, i)).toISOString(),
  // unix ms number → timestamp
  ingestedAt: Date.UTC(2024, 2, 1, 0, i),
  // ≤ 10 distinct + "level" word → enum with defaultOpen
  level: LEVELS[i % LEVELS.length]!,
  // boolean
  cached: i % 2 === 0,
  // min !== max → slider; "latency" word → heatmap display
  latency: 50 + i * 10,
  // min === max → input filter, NOT a slider
  retries: 3,
  // ≤ 10 distinct items → array of enum, with checkbox options
  regions: [
    [REGIONS[0]!, REGIONS[1]!],
    [REGIONS[2]!],
    [REGIONS[3]!, REGIONS[4]!],
  ][i % 3]!,
  // 24 distinct items → array of string, not filterable
  fingerprints: [`fp-${i}-a`, `fp-${i}-b`],
  // plain object → record
  headers: { "content-type": "application/json", "x-request-id": `req_${i}` },
}));

/** Rows whose enum values trip the semantic colorMap heuristic. */
const STATUS_ROWS = [
  { status: "active", score: 91 },
  { status: "pending", score: 42 },
  { status: "failed", score: 7 },
];

const DATE_PRESETS = [
  {
    label: "Last hour",
    shortcut: "h",
    from: new Date("2024-03-01T09:00:00.000Z"),
    to: new Date("2024-03-01T10:00:00.000Z"),
  },
  {
    label: "Last day",
    shortcut: "d",
    from: new Date("2024-02-29T10:00:00.000Z"),
    to: new Date("2024-03-01T10:00:00.000Z"),
  },
];

/** Every `col.*` factory, plus every chain step that is not a preset. */
const handAuthored = createTableSchema({
  select: col.select(),
  host: col
    .string()
    .label("Host")
    .description("Origin hostname the request was served from")
    .size(125)
    .resizable()
    .sortable()
    .sheet({ label: "Hostname", skeletonClassName: "w-24" }),
  message: col
    .string()
    .optional()
    .label("Message")
    .sheetOnly()
    .sheet({ className: "flex-col items-start" }),
  bytes: col
    .number()
    .label("Bytes")
    .display("number", { unit: "B" })
    .filterable("slider", { min: 0, max: 1024, unit: "B" })
    .sortable(),
  port: col
    .number()
    .label("Port")
    .filterable("checkbox", {
      options: [
        { label: "80", value: 80 },
        { label: "443", value: 443 },
      ],
    })
    .commandDisabled(),
  cached: col.boolean().label("Cache Hit").defaultOpen().hideHeader(),
  seenAt: col
    .timestamp()
    .label("Seen At")
    .filterable("timerange", { presets: DATE_PRESETS })
    .sortable()
    .size(200)
    .sheet(),
  level: col
    .enum(LEVELS)
    .label("Level")
    .display("badge", { colorMap: { error: "#ef4444", warn: "#f59e0b" } })
    .hideHeader()
    .defaultOpen()
    .size(27),
  regions: col
    .array(col.enum(REGIONS))
    .label("Regions")
    .filterable("checkbox", {
      options: REGIONS.map((r) => ({ label: r.toUpperCase(), value: r })),
    })
    .resizable(),
  fingerprints: col
    .array(col.string())
    .label("Fingerprints")
    .notFilterable()
    .hidden()
    .sheet(),
  headers: col
    .record()
    .label("Headers")
    .sheetOnly()
    .sheet({ className: "flex-col items-start w-full gap-1" }),
});

/** Every `col.presets.*` preset, with and without its optional arguments. */
const presetAuthored = createTableSchema({
  level: col.presets.logLevel(LEVELS).description("Log severity").size(27),
  method: col.presets.httpMethod(METHODS).size(69),
  status: col.presets.httpStatus().label("Status").size(60),
  statusCustom: col.presets
    .httpStatus([200, 404, 500])
    .label("Status (custom)"),
  duration: col.presets.duration("ms").label("Latency").sortable().size(110),
  durationCustom: col.presets
    .duration("s", { min: 0, max: 60 })
    .label("Response Time"),
  durationDefaults: col.presets.duration().label("Elapsed"),
  date: col.presets.timestamp().label("Date").size(200).sheet(),
  traceId: col.presets
    .traceId()
    .label("Request ID")
    .hidden()
    .sheet({ skeletonClassName: "w-64" }),
  path: col.presets.pathname().label("Path").size(130).sheet(),
  latency: col.presets.latency("ms").label("Latency (heatmap)"),
  latencyCustom: col.presets.latency("s", { min: 0, max: 60 }).label("Slow"),
  health: col.presets.health().label("Health"),
  healthCustom: col.presets.health({ min: 0, max: 1000 }).label("Score"),
  progress: col.presets.progress().label("Progress"),
  progressCustom: col.presets
    .progress({ min: 0, max: 1000 })
    .label("Completion"),
});

// ── Law C: codegen round trip ───────────────────────────────────────────────

/** Narrow a schema down to a single column, keeping it a valid `SchemaJSON`. */
function onlyColumn(json: SchemaJSON, key: string): SchemaJSON {
  const column = json.columns.find((c) => c.key === key);
  if (!column) throw new Error(`no inferred column "${key}"`);
  return { version: json.version, columns: [column] };
}

describe("schemaToTypeScript — round trip (inferred schemas)", () => {
  it("round-trips a full log table inferred from rows", () => {
    expectInferredRoundTrip(inferSchemaFromJSON(LOG_ROWS));
  });

  it("round-trips each inferred column in isolation", () => {
    const json = inferSchemaFromJSON(LOG_ROWS);
    for (const column of json.columns) {
      expectInferredRoundTrip({ version: json.version, columns: [column] });
    }
  });

  it("emits a boolean column whose filter options survive the round trip", () => {
    // Regression guard on a two-construction-paths bug: inference used to omit
    // the checkbox options that `col.boolean()` bakes in, and no chain step can
    // clear a factory's options — so the emitted code silently re-attached
    // them. The two paths must agree for the law above to hold.
    const json = onlyColumn(inferSchemaFromJSON(LOG_ROWS), "cached");
    expect(json.columns[0]!.filter).toEqual({
      type: "checkbox",
      defaultOpen: false,
      commandDisabled: false,
      options: [
        { label: "true", value: true },
        { label: "false", value: false },
      ],
    });
    expect(rebuild(json).toJSON().columns[0]!.filter).toEqual(
      json.columns[0]!.filter,
    );
  });

  it("round-trips an enum inferred with a semantic colorMap", () => {
    expectInferredRoundTrip(inferSchemaFromJSON(STATUS_ROWS));
  });

  it("round-trips an empty schema", () => {
    expectInferredRoundTrip(inferSchemaFromJSON([]));
  });

  it("covers the inference rules the emitter has to distinguish", () => {
    const byKey = Object.fromEntries(
      inferSchemaFromJSON(LOG_ROWS).columns.map((c) => [c.key, c]),
    );

    // string[] above the enum threshold stays an array of strings
    expect(byKey.fingerprints).toMatchObject({
      kind: "array",
      arrayItem: { kind: "string" },
      filter: null,
    });
    // …while a small value set becomes an array of enum with checkbox options
    expect(byKey.regions).toMatchObject({
      kind: "array",
      arrayItem: { kind: "enum" },
      filter: { type: "checkbox" },
    });
    expect(byKey.headers).toMatchObject({ kind: "record" });
    expect(byKey.cached).toMatchObject({ kind: "boolean" });
    expect(byKey.createdAt).toMatchObject({
      kind: "timestamp",
      provenance: { rule: "iso8601-string" },
    });
    expect(byKey.ingestedAt).toMatchObject({
      kind: "timestamp",
      provenance: { rule: "unix-ms-number" },
    });
    // min === max infers an input filter, not a zero-width slider
    expect(byKey.retries).toMatchObject({
      kind: "number",
      filter: { type: "input" },
    });
    expect(byKey.latency).toMatchObject({
      kind: "number",
      filter: { type: "slider" },
    });
  });
});

describe("schemaToTypeScript — round trip (hand-authored schemas)", () => {
  it("round-trips every col.* factory and chain step", () => {
    expectRoundTrip(handAuthored.toJSON());
  });

  it("round-trips each hand-authored column in isolation", () => {
    const json = handAuthored.toJSON();
    for (const column of json.columns) {
      expectRoundTrip({ version: json.version, columns: [column] });
    }
  });

  it("round-trips every col.presets.* preset", () => {
    expectRoundTrip(presetAuthored.toJSON());
  });

  it("round-trips each preset column in isolation", () => {
    const json = presetAuthored.toJSON();
    for (const column of json.columns) {
      expectRoundTrip({ version: json.version, columns: [column] });
    }
  });

  it("round-trips a second time — emission is a fixed point", () => {
    const once = rebuild(handAuthored.toJSON()).toJSON();
    expect(rebuild(once).toJSON()).toEqual(once);
  });

  it("preserves the chain steps the old serializer dropped", () => {
    const json = handAuthored.toJSON();
    const byKey = Object.fromEntries(
      rebuild(json)
        .toJSON()
        .columns.map((c) => [c.key, c]),
    );

    expect(byKey.host).toMatchObject({ resizable: true });
    expect(byKey.cached).toMatchObject({ hideHeader: true });
    expect(byKey.message).toMatchObject({
      hidden: true,
      enableHiding: false,
      filter: null,
    });
    expect(byKey.bytes).toMatchObject({ filter: { unit: "B" } });
    expect(byKey.seenAt).toMatchObject({
      filter: {
        presets: [
          {
            label: "Last hour",
            shortcut: "h",
            from: "2024-03-01T09:00:00.000Z",
            to: "2024-03-01T10:00:00.000Z",
          },
          expect.objectContaining({ label: "Last day" }),
        ],
      },
    });
  });
});

// ── Provenance-driven factory selection ─────────────────────────────────────

describe("schemaToTypeScript — factory selection reads provenance", () => {
  it("re-emits a preset column as the preset call, not a raw factory chain", () => {
    const schema = createTableSchema({
      level: col.presets.logLevel(LEVELS).label("Level"),
    });
    const ts = schemaToTypeScript(schema.toJSON());

    // Array args are spaced the same way everywhere, so a preset call and a
    // raw `col.enum([...])` are formatted identically.
    expect(ts).toContain('col.presets.logLevel(["error", "warn", "info"])');
    expect(ts).not.toContain("col.enum(");
    // The preset baseline already supplies these — only `.label()` differs.
    expect(ts).not.toContain('.filterable("checkbox"');
    expect(ts).not.toContain(".defaultOpen()");
    expectRoundTrip(schema.toJSON());
  });

  it("does NOT mis-attribute a hand-built column that looks like a preset", () => {
    // Shape-matching (`detectPreset`) called this `col.presets.timestamp()`,
    // silently swapping the author's label default and chain.
    const schema = createTableSchema({
      date: col.timestamp().label("Date").sortable(),
    });
    const ts = schemaToTypeScript(schema.toJSON());

    expect(ts).toContain("col.timestamp()");
    expect(ts).not.toContain("col.presets.");
    expect(ts).toContain(".sortable()");
    expectRoundTrip(schema.toJSON());
  });

  it("does NOT mis-attribute an enum that merely resembles logLevel", () => {
    const schema = createTableSchema({
      level: col.enum(LEVELS).label("Level").defaultOpen(),
    });
    const ts = schemaToTypeScript(schema.toJSON());

    expect(ts).toContain('col.enum(["error", "warn", "info"])');
    expect(ts).not.toContain("col.presets.");
    expectRoundTrip(schema.toJSON());
  });

  it("falls back to the primitive factory for an unknown preset name", () => {
    const json = presetAuthored.toJSON();
    const level = json.columns.find((c) => c.key === "level")!;
    const forged: SchemaJSON = {
      version: json.version,
      columns: [
        {
          ...level,
          provenance: { source: "preset", preset: "fromTheFuture", args: [] },
        },
      ],
    };
    const ts = schemaToTypeScript(forged);

    expect(ts).not.toContain("col.presets.fromTheFuture");
    expect(ts).toContain("col.enum(");
    // Everything except the unknowable provenance survives the fallback.
    expect(rebuild(forged).toJSON().columns[0]).toEqual({
      ...forged.columns[0],
      provenance: { source: "manual" },
    });
  });

  it("does not swallow the filter of a column that merely looks sheet-only", () => {
    // `enableHiding: false` + `hidden` is the shape `.sheetOnly()` leaves
    // behind, and the emitter skips the `filter` step for it because
    // `.sheetOnly()` nulls the filter itself. A builder cannot produce that
    // shape with a filter still attached — `validateSchema` rejects it — but
    // `schemaToTypeScript` takes raw `SchemaJSON`, so it can still be handed
    // one. It used to emit `.sheetOnly()` and drop the filter with no trace.
    const json = createTableSchema({
      latency: col
        .number()
        .label("Latency")
        .filterable("slider", { min: 1, max: 5 }),
    }).toJSON();
    const forged: SchemaJSON = {
      version: json.version,
      columns: [{ ...json.columns[0]!, hidden: true, enableHiding: false }],
    };

    const ts = schemaToTypeScript(forged);
    expect(ts).toContain('.filterable("slider", { min: 1, max: 5 })');
  });
});

// ── Exhaustive emitter coverage ─────────────────────────────────────────────
//
// `EMITTERS` is `{ [K in keyof ColumnDescriptorCommon]-?: Emitter<K> }`, so a
// missing emitter is a compile error. `EMIT_ORDER` is a plain array and is NOT
// compile-checked — a field with an emitter that nobody lists here is silently
// never emitted. That is exactly how `.hideHeader()` and `.resizable()` went
// missing, so it gets a test.

/**
 * Every key of `ColumnDescriptorCommon`, enumerated at runtime.
 *
 * Typed as `Record<keyof ColumnDescriptorCommon, true>`, so adding a field to
 * the descriptor without adding it here is a compile error, and a stale key
 * left behind is one too.
 */
const DESCRIPTOR_KEYS: Record<keyof ColumnDescriptorCommon, true> = {
  label: true,
  description: true,
  optional: true,
  display: true,
  size: true,
  hidden: true,
  enableHiding: true,
  hideHeader: true,
  resizable: true,
  sortable: true,
  filter: true,
  sheet: true,
  provenance: true,
};

/** Keys with an emitter that is deliberately absent from `EMIT_ORDER`. */
const NOT_A_CHAIN_STEP = new Set<keyof ColumnDescriptorCommon>([
  // `provenance` selects the *factory call* (`col.presets.logLevel(...)` vs
  // `col.enum(...)`); there is no chain step to append for it.
  "provenance",
]);

describe("EMIT_ORDER", () => {
  it("lists every ColumnDescriptorCommon key that is a chain step", () => {
    const listed = new Set<string>([...EMIT_ORDER, ...NOT_A_CHAIN_STEP]);
    const missing = Object.keys(DESCRIPTOR_KEYS).filter((k) => !listed.has(k));
    expect(missing).toEqual([]);
  });

  it("lists no key twice and no key that is not a descriptor field", () => {
    expect(new Set(EMIT_ORDER).size).toBe(EMIT_ORDER.length);
    const unknown = EMIT_ORDER.filter((k) => !(k in DESCRIPTOR_KEYS));
    expect(unknown).toEqual([]);
  });

  it("matches the keys a real descriptor actually carries", () => {
    // Guards the compile-time list above against drifting from runtime shape:
    // `description` and `size` are optional, so they need setting to appear.
    const resolved = resolveColumn(col.string().description("d").size(1));
    const runtimeKeys = Object.keys(resolved).filter(
      (k) => k !== "kind" && k !== "renderers",
    );
    expect(runtimeKeys.sort()).toEqual(Object.keys(DESCRIPTOR_KEYS).sort());
  });

  it("emits filter before enableHiding, so .sheetOnly() can clear it", () => {
    expect(EMIT_ORDER.indexOf("filter")).toBeLessThan(
      EMIT_ORDER.indexOf("enableHiding"),
    );
    expect(EMIT_ORDER.indexOf("enableHiding")).toBeLessThan(
      EMIT_ORDER.indexOf("hidden"),
    );
  });
});

// ── Readability of the emitted source ───────────────────────────────────────
//
// The round-trip law says the code is *correct*. These say it is code a human
// would have written.

describe("schemaToTypeScript — emitted formatting", () => {
  it("emits an import, a createTableSchema wrapper, and a close", () => {
    const ts = schemaToTypeScript(createTableSchema({}).toJSON());
    expect(ts).toContain(
      'import { createTableSchema, col } from "@dtf/registry/lib/table-schema"',
    );
    expect(ts).toContain("export const schema = createTableSchema({");
    expect(ts).toContain("});");
  });

  it("emits array columns with an item builder, never a bare col.array()", () => {
    const ts = schemaToTypeScript(handAuthored.toJSON());
    expect(ts).toContain('col.array(col.enum(["ams", "gru", "hkg"');
    expect(ts).toContain("col.array(col.string()");
    expect(ts).not.toContain("col.array()");
  });

  it("emits object literals with unquoted keys", () => {
    const ts = schemaToTypeScript(handAuthored.toJSON());
    expect(ts).toContain(
      '.filterable("slider", { min: 0, max: 1024, unit: "B" })',
    );
    expect(ts).toContain(
      '.sheet({ label: "Hostname", skeletonClassName: "w-24" })',
    );
    expect(ts).toContain('{ label: "80", value: 80 }');
  });

  it("skips chain steps the factory already provides", () => {
    const ts = schemaToTypeScript(
      createTableSchema({ host: col.string().label("Host") }).toJSON(),
    );
    expect(ts).not.toContain('.display("text")');
    expect(ts).not.toContain('.filterable("input")');
    expect(ts).toBe(
      [
        'import { createTableSchema, col } from "@dtf/registry/lib/table-schema";',
        "",
        "export const schema = createTableSchema({",
        "  host: col.string()",
        '    .label("Host"),',
        "});",
      ].join("\n"),
    );
  });

  it("puts each chain step on its own indented line", () => {
    const ts = schemaToTypeScript(handAuthored.toJSON());
    expect(ts).toContain("\n    .label(");
  });
});

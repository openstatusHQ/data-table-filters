import { describe, expect, it } from "vitest";
import { col, resolveColumns } from "./col";
import { createTableSchema } from "./index";
import { inferSchemaFromJSON } from "./infer";
import { presets } from "./presets";
import {
  deserializeSchema,
  migrateSchemaJSON,
  SCHEMA_JSON_VERSION,
  serializeSchema,
} from "./serialize";
import type { ColumnDescriptor, TableSchemaDefinition } from "./types";

/**
 * The old suite's round-trip helper was
 * `serialize(deserialize(serialize(def)))` compared against `serialize(def)` —
 * a fixed point on the *projection*, not on the schema. Any field the
 * serializer dropped was dropped identically on both sides, so all of it passed
 * while `unit`, `presets`, and `resizable` fell on the floor.
 *
 * Law A below compares against the **original definition** instead: the
 * descriptor half of `resolveColumns(def)` must equal the descriptor half of
 * `resolveColumns(deserializeSchema(serializeSchema(def)))`. Renderers are
 * deliberately not preserved (they are closures), so only the descriptors are
 * compared — and the descriptor is, by construction, everything else.
 */

// ── Helpers ─────────────────────────────────────────────────────────────────

/** The descriptor half of every column, in insertion order. Renderers dropped. */
function descriptors(
  definition: TableSchemaDefinition,
): Array<ColumnDescriptor & { key: string }> {
  return resolveColumns(definition).map(
    ({ renderers, ...descriptor }) => descriptor,
  );
}

/** Serialize, deserialize, and hand back the reconstructed definition. */
function roundTrip(definition: TableSchemaDefinition): TableSchemaDefinition {
  return deserializeSchema(serializeSchema(definition));
}

/** Assert Law A for a whole schema. */
function expectRoundTripsToOriginal(definition: TableSchemaDefinition): void {
  expect(descriptors(roundTrip(definition))).toEqual(descriptors(definition));
}

/** Look up one serialized column by key. */
function column(definition: TableSchemaDefinition, key: string) {
  const found = serializeSchema(definition).columns.find((c) => c.key === key);
  if (!found) throw new Error(`no column "${key}" in serialized schema`);
  return found;
}

/** Paths at which a value would not survive `JSON.stringify` intact. */
function jsonSafetyViolations(value: unknown, path = "$"): string[] {
  if (value === null || value === undefined) return [];
  if (value instanceof Date) return [`${path}: Date`];
  if (typeof value === "function") return [`${path}: function`];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      item === undefined
        ? [`${path}[${index}]: undefined inside an array`]
        : jsonSafetyViolations(item, `${path}[${index}]`),
    );
  }
  if (typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) =>
      jsonSafetyViolations(v, `${path}.${k}`),
    );
  }
  return [];
}

// ── Fixtures ────────────────────────────────────────────────────────────────
//
// `apps/web/src/app/infinite/table-schema.tsx` is the real-world schema this
// suite is meant to protect, but it is NOT importable from here: it lives in
// another workspace, is a `.tsx` resolved through that workspace's `@/*` path
// alias (the registry's tsconfig only maps `@dtf/registry/*`), and pulls in
// React components — and `packages/registry` must not depend on `apps/web`
// anyway. `logsSchema` below is a feature-equivalent local reconstruction:
// same column kinds, same custom cell / filter / sheet renderers, same
// `resizable` + `unit` + `sheetOnly` + `hideHeader` + `select` combinations.

const LEVELS = ["success", "warning", "error"] as const;
const METHODS = ["GET", "POST", "PUT", "DELETE"] as const;
const REGIONS = ["ams", "fra", "gru", "hkg", "iad", "syd"] as const;

const logsSchema = {
  select: col.select().size(37),

  level: col
    .enum(LEVELS)
    .label("Level")
    .hideHeader()
    .display("custom", { cell: () => null })
    .filterable("checkbox", {
      options: LEVELS.map((level) => ({ label: level, value: level })),
      component: () => null,
    })
    .defaultOpen()
    .size(37),

  date: col
    .timestamp()
    .label("Date")
    .display("timestamp")
    .defaultOpen()
    .commandDisabled()
    .size(200)
    .sortable()
    .sheet({ component: () => "1970-01-01", skeletonClassName: "w-36" }),

  uuid: col.string().label("Request Id").notFilterable().hidden().sheet({
    label: "Request ID",
    skeletonClassName: "w-64",
  }),

  status: col
    .number()
    .label("Status")
    .display("custom", { cell: () => null })
    .filterable("checkbox", {
      options: [
        { label: "200", value: 200 },
        { label: "400", value: 400 },
        { label: "404", value: 404 },
        { label: "500", value: 500 },
      ],
      component: () => null,
    })
    .size(60)
    .sheet({ component: () => "200", skeletonClassName: "w-12" }),

  method: col
    .enum(METHODS)
    .label("Method")
    .display("text")
    .filterable("checkbox", {
      options: METHODS.map((m) => ({ label: m, value: m })),
      component: () => null,
    })
    .size(69)
    .sheet({ component: () => "GET", skeletonClassName: "w-10" }),

  host: col
    .string()
    .label("Host")
    .filterable("input")
    .size(125)
    .resizable()
    .sheet({ skeletonClassName: "w-24" }),

  latency: col
    .number()
    .label("Latency")
    .display("bar", { min: 0, max: 5000, unit: "ms" })
    .filterable("slider", { min: 0, max: 5000, unit: "ms" })
    .size(110)
    .sortable()
    .sheet({ component: () => "12ms", skeletonClassName: "w-16" }),

  regions: col
    .array(col.enum(REGIONS))
    .label("Regions")
    .display("custom", { cell: () => null })
    .filterable("checkbox", {
      options: REGIONS.map((r) => ({ label: r, value: r })),
      component: () => null,
    })
    .size(163)
    .sheet({ component: () => "ams", skeletonClassName: "w-12" }),

  percentile: col
    .number()
    .optional()
    .label("Percentile")
    .sheetOnly()
    .sheet({ component: () => "p95", skeletonClassName: "w-12" }),

  "timing.dns": col
    .number()
    .label("DNS")
    .filterable("slider", { min: 0, max: 5000, unit: "ms" })
    .size(110)
    .sortable()
    .hidden()
    .sheet({
      label: "Timing Phases",
      component: () => "phases",
      className: "flex-col items-start w-full gap-1",
    }),

  headers: col
    .record()
    .label("Headers")
    .sheetOnly()
    .sheet({
      component: () => "headers",
      className: "flex-col items-start w-full gap-1",
    }),

  message: col
    .string()
    .optional()
    .label("Message")
    .sheetOnly()
    .sheet({
      condition: () => true,
      component: () => "message",
      className: "flex-col items-start w-full gap-1",
    }),
} satisfies TableSchemaDefinition;

/** Every `col.presets.*`, so `provenance: { source: "preset" }` is exercised. */
const presetsSchema = {
  level: presets.logLevel(LEVELS),
  method: presets.httpMethod(METHODS),
  status: presets.httpStatus(),
  statusCustom: presets.httpStatus([200, 500]),
  duration: presets.duration("ms"),
  durationBounded: presets.duration("s", { min: 0, max: 60 }),
  date: presets.timestamp(),
  traceId: presets.traceId(),
  path: presets.pathname(),
  latency: presets.latency("ms"),
  health: presets.health(),
  progress: presets.progress({ min: 0, max: 1000 }),
} satisfies TableSchemaDefinition;

const HOUR_PRESET = {
  label: "Last hour",
  shortcut: "h",
  from: new Date("2024-05-01T00:00:00.000Z"),
  to: new Date("2024-05-01T01:00:00.000Z"),
};
const DAY_PRESET = {
  label: "Last day",
  shortcut: "d",
  from: new Date("2024-04-30T01:00:00.000Z"),
  to: new Date("2024-05-01T01:00:00.000Z"),
};

/** The RFC's adversarial corpus: every field the old serializer dropped. */
const adversarialSchema = {
  // `unit` + `presets` + `resizable`, all three in one schema.
  window: col
    .timestamp()
    .label("Window")
    .filterable("timerange", { presets: [HOUR_PRESET, DAY_PRESET] })
    .resizable()
    .size(220),
  latency: col
    .number()
    .label("Latency")
    .display("number", { unit: "ms" })
    .filterable("slider", { min: 0, max: 5000, unit: "ms" })
    .resizable(),
  // A `string[]` column — not an enum array. The old deserializer collapsed
  // any non-enum array to `col.string()`.
  tags: col.array(col.string()).label("Tags"),
  // A custom cell on an enum column: the closure goes to the renderers half and
  // the descriptor keeps its serializable `badge` display.
  level: col
    .enum(LEVELS)
    .label("Level")
    .display("custom", { cell: () => null }),
  // Flags that used to be optional and are now always present.
  sheetOnly: col.record().label("Meta").sheetOnly().sheet({ label: "Meta" }),
  bare: col.select(),
} satisfies TableSchemaDefinition;

/** 11 distinct tag values — one more than the enum inference threshold. */
const MANY_TAG_ROWS = Array.from({ length: 11 }, (_, i) => ({
  tags: [`tag-${i}`],
  name: `row-${i}`,
}));

// ── Law A: round trip against the original, not another projection ──────────

describe("Law A — deserialize(serialize(def)) reproduces def's descriptors", () => {
  it("round-trips the logs schema (equivalent of apps/web infinite)", () => {
    expectRoundTripsToOriginal(logsSchema);
  });

  it("round-trips every col.presets.* column", () => {
    expectRoundTripsToOriginal(presetsSchema);
  });

  it("round-trips the adversarial corpus", () => {
    expectRoundTripsToOriginal(adversarialSchema);
  });

  it("round-trips one column of every kind", () => {
    expectRoundTripsToOriginal({
      string: col.string().label("String"),
      number: col.number().label("Number"),
      boolean: col.boolean().label("Boolean"),
      timestamp: col.timestamp().label("Timestamp"),
      enum: col.enum(LEVELS).label("Enum"),
      arrayOfEnum: col.array(col.enum(REGIONS)).label("Array of enum"),
      arrayOfString: col.array(col.string()).label("Array of string"),
      arrayOfNumber: col.array(col.number()).label("Array of number"),
      nestedArray: col.array(col.array(col.string())).label("Nested array"),
      record: col.record().label("Record"),
      select: col.select(),
    });
  });

  it("round-trips every display type", () => {
    expectRoundTripsToOriginal({
      text: col
        .string()
        .label("Text")
        .display("text", { colorMap: { a: "#1" } }),
      code: col.string().label("Code").display("code"),
      boolean: col.boolean().label("Boolean").display("boolean"),
      star: col.boolean().label("Star").display("star"),
      badge: col
        .enum(LEVELS)
        .label("Badge")
        .display("badge", {
          colorMap: { success: "#22c55e" },
        }),
      timestamp: col.timestamp().label("Timestamp").display("timestamp"),
      number: col
        .number()
        .label("Number")
        .display("number", { unit: "pts", colorMap: { "100": "#22c55e" } }),
      bar: col
        .number()
        .label("Bar")
        .display("bar", { min: 0, max: 5000, unit: "ms" }),
      heatmap: col
        .number()
        .label("Heatmap")
        .display("heatmap", { min: 0, max: 100, color: "#ef4444" }),
      gauge: col
        .number()
        .label("Gauge")
        .display("gauge", { min: 0, max: 100, color: "#22c55e" }),
      statusCode: col.number().label("Status").display("status-code"),
      levelIndicator: col.string().label("Level").display("level-indicator"),
    });
  });

  it("round-trips an inferred schema, including a >10-distinct string[] column", () => {
    const inferred = deserializeSchema(inferSchemaFromJSON(MANY_TAG_ROWS));
    expectRoundTripsToOriginal(inferred);
  });

  it("is idempotent — a second trip changes nothing", () => {
    const once = roundTrip(logsSchema);
    expect(descriptors(roundTrip(once))).toEqual(descriptors(once));
  });

  it("preserves key insertion order", () => {
    expect(Object.keys(roundTrip(logsSchema))).toEqual(Object.keys(logsSchema));
    expect(serializeSchema(logsSchema).columns.map((c) => c.key)).toEqual(
      Object.keys(logsSchema),
    );
  });

  it("stamps the current version", () => {
    expect(serializeSchema(logsSchema).version).toBe(SCHEMA_JSON_VERSION);
    expect(SCHEMA_JSON_VERSION).toBe(1);
  });

  it("drops renderers — the one documented, deliberate loss", () => {
    const original = resolveColumns(logsSchema).find((c) => c.key === "level")!;
    const reconstructed = resolveColumns(roundTrip(logsSchema)).find(
      (c) => c.key === "level",
    )!;
    expect(typeof original.renderers.cell).toBe("function");
    expect(typeof original.renderers.filterComponent).toBe("function");
    expect(reconstructed.renderers).toEqual({});
  });
});

// ── Serialization completeness — the concrete defects ───────────────────────

describe("serialization completeness", () => {
  it("keeps filter.unit", () => {
    const latency = column(adversarialSchema, "latency");
    expect(latency.filter?.unit).toBe("ms");
    expect(column(roundTrip(adversarialSchema), "latency").filter?.unit).toBe(
      "ms",
    );
  });

  it("keeps display unit", () => {
    const latency = column(adversarialSchema, "latency");
    expect(latency.display).toEqual({ type: "number", unit: "ms" });
    expect(column(roundTrip(adversarialSchema), "latency").display).toEqual({
      type: "number",
      unit: "ms",
    });
  });

  it("keeps filter.presets, as ISO instants", () => {
    const expected = [
      {
        label: "Last hour",
        shortcut: "h",
        from: "2024-05-01T00:00:00.000Z",
        to: "2024-05-01T01:00:00.000Z",
      },
      {
        label: "Last day",
        shortcut: "d",
        from: "2024-04-30T01:00:00.000Z",
        to: "2024-05-01T01:00:00.000Z",
      },
    ];
    expect(column(adversarialSchema, "window").filter?.presets).toEqual(
      expected,
    );
    expect(
      column(roundTrip(adversarialSchema), "window").filter?.presets,
    ).toEqual(expected);
  });

  it("keeps resizable", () => {
    expect(column(adversarialSchema, "window").resizable).toBe(true);
    expect(column(adversarialSchema, "latency").resizable).toBe(true);
    expect(column(adversarialSchema, "tags").resizable).toBe(false);
    expect(column(roundTrip(adversarialSchema), "window").resizable).toBe(true);
    expect(column(logsSchema, "host").resizable).toBe(true);
    expect(column(roundTrip(logsSchema), "host").resizable).toBe(true);
  });

  it("keeps enableHiding, in both directions", () => {
    // sheetOnly() ⇒ enableHiding: false, hidden: true
    expect(column(adversarialSchema, "sheetOnly")).toMatchObject({
      enableHiding: false,
      hidden: true,
      filter: null,
    });
    // col.select() ⇒ enableHiding: false but hidden: false. The old
    // deserializer inferred `.sheetOnly()` from `enableHiding === false` and
    // hid the selection column.
    expect(column(adversarialSchema, "bare")).toMatchObject({
      enableHiding: false,
      hidden: false,
    });
    expect(column(roundTrip(adversarialSchema), "bare")).toMatchObject({
      enableHiding: false,
      hidden: false,
    });
    // Everything else defaults to true, explicitly present.
    expect(column(adversarialSchema, "tags").enableHiding).toBe(true);
  });

  it("keeps hideHeader", () => {
    expect(column(logsSchema, "level").hideHeader).toBe(true);
    expect(column(roundTrip(logsSchema), "level").hideHeader).toBe(true);
    expect(column(logsSchema, "host").hideHeader).toBe(false);
  });

  it("keeps provenance for manual, preset, and inferred columns", () => {
    expect(column(logsSchema, "host").provenance).toEqual({ source: "manual" });

    expect(column(presetsSchema, "duration").provenance).toEqual({
      source: "preset",
      preset: "duration",
      args: ["ms"],
    });
    expect(column(presetsSchema, "durationBounded").provenance).toEqual({
      source: "preset",
      preset: "duration",
      args: ["s", { min: 0, max: 60 }],
    });
    expect(column(presetsSchema, "status").provenance).toEqual({
      source: "preset",
      preset: "httpStatus",
      args: [],
    });
    expect(column(presetsSchema, "level").provenance).toEqual({
      source: "preset",
      preset: "logLevel",
      args: [[...LEVELS]],
    });
    // ...and it survives the trip, which is what `schemaToTypeScript` relies on.
    expect(
      column(roundTrip(presetsSchema), "durationBounded").provenance,
    ).toEqual({
      source: "preset",
      preset: "duration",
      args: ["s", { min: 0, max: 60 }],
    });

    const inferred = inferSchemaFromJSON(MANY_TAG_ROWS);
    for (const c of inferred.columns) {
      expect(c.provenance).toMatchObject({ source: "inferred" });
    }
  });

  it("keeps description and size", () => {
    const def = {
      host: col
        .string()
        .label("Host")
        .description("The origin server hostname")
        .size(125),
    };
    expect(column(def, "host")).toMatchObject({
      description: "The origin server hostname",
      size: 125,
    });
    expect(column(roundTrip(def), "host")).toMatchObject({
      description: "The origin server hostname",
      size: 125,
    });
  });

  it("keeps minSize", () => {
    const def = { date: col.timestamp().label("Date").minSize(200) };
    expect(column(def, "date").minSize).toBe(200);
    expect(column(roundTrip(def), "date").minSize).toBe(200);
  });

  it("keeps the sheet descriptor while dropping its closures", () => {
    const sheet = column(logsSchema, "timing.dns").sheet;
    expect(sheet).toEqual({
      label: "Timing Phases",
      className: "flex-col items-start w-full gap-1",
    });
    expect(sheet).not.toHaveProperty("component");
    expect(sheet).not.toHaveProperty("condition");
    // `.sheet()` with no config is still a sheet — `{}`, not `null`.
    expect(
      column({ host: col.string().label("H").sheet() }, "host").sheet,
    ).toEqual({});
    expect(column({ host: col.string().label("H") }, "host").sheet).toBeNull();
  });
});

// ── Adversarial corpus ──────────────────────────────────────────────────────

describe("adversarial corpus", () => {
  it("keeps a string[] column a string[] column (11 distinct values)", () => {
    const inferred = inferSchemaFromJSON(MANY_TAG_ROWS);
    const tags = inferred.columns.find((c) => c.key === "tags")!;
    expect(tags.kind).toBe("array");
    expect(tags.kind === "array" && tags.arrayItem.kind).toBe("string");
    expect(tags.filter).toBeNull();

    // ...and it stays one through the builder round trip. The old
    // deserializer collapsed every non-enum array to `col.string()`.
    const reconstructed = column(deserializeSchema(inferred), "tags");
    expect(reconstructed.kind).toBe("array");
    expect(reconstructed.kind === "array" && reconstructed.arrayItem.kind).toBe(
      "string",
    );

    // Hand-built, same law.
    const built = column(adversarialSchema, "tags");
    expect(built.kind === "array" && built.arrayItem.kind).toBe("string");
    expect(
      column(roundTrip(adversarialSchema), "tags").kind === "array" &&
        (
          column(roundTrip(adversarialSchema), "tags") as ColumnDescriptor & {
            kind: "array";
          }
        ).arrayItem.kind,
    ).toBe("string");
  });

  it("infers an enum item at the threshold (10 distinct) and a string item above it", () => {
    const ten = Array.from({ length: 10 }, (_, i) => ({ tags: [`tag-${i}`] }));
    const tenCol = inferSchemaFromJSON(ten).columns[0]!;
    expect(tenCol.kind === "array" && tenCol.arrayItem.kind).toBe("enum");

    const eleven = inferSchemaFromJSON(MANY_TAG_ROWS).columns[0]!;
    expect(eleven.kind === "array" && eleven.arrayItem.kind).toBe("string");
  });

  it("serializes a custom display on an enum column as its real display type", () => {
    const level = column(adversarialSchema, "level");
    // Not `{ type: "custom" }` — that shape carried a closure and could not
    // survive JSON, so `display` never enters it.
    expect(level.display).toEqual({ type: "badge" });
    expect(column(roundTrip(adversarialSchema), "level").display).toEqual({
      type: "badge",
    });
    // The closure lives on the other half instead.
    const resolved = resolveColumns(adversarialSchema).find(
      (c) => c.key === "level",
    )!;
    expect(typeof resolved.renderers.cell).toBe("function");
  });

  it("merges a colorMap passed alongside a custom cell into the descriptor", () => {
    const def = {
      level: col
        .enum(LEVELS)
        .label("Level")
        .display("custom", {
          cell: () => null,
          colorMap: { error: "#ef4444" },
        }),
    };
    expect(column(def, "level").display).toEqual({
      type: "badge",
      colorMap: { error: "#ef4444" },
    });
    expectRoundTripsToOriginal(def);
  });

  it("keeps unit, presets, and resizable together in one schema", () => {
    const json = serializeSchema(adversarialSchema);
    const window = json.columns.find((c) => c.key === "window")!;
    const latency = json.columns.find((c) => c.key === "latency")!;
    expect(window.resizable).toBe(true);
    expect(window.filter?.presets).toHaveLength(2);
    expect(latency.resizable).toBe(true);
    expect(latency.filter?.unit).toBe("ms");
    expect(latency.display).toMatchObject({ unit: "ms" });
    expectRoundTripsToOriginal(adversarialSchema);
  });
});

// ── JSON safety ─────────────────────────────────────────────────────────────

describe("JSON safety", () => {
  const cases: Array<[string, TableSchemaDefinition]> = [
    ["logs schema", logsSchema],
    ["presets schema", presetsSchema],
    ["adversarial schema", adversarialSchema],
  ];

  for (const [name, definition] of cases) {
    it(`survives JSON.parse(JSON.stringify(...)) unchanged — ${name}`, () => {
      const json = createTableSchema(definition).toJSON();
      expect(JSON.parse(JSON.stringify(json))).toEqual(json);
    });

    it(`contains no Date, function, or undefined array element — ${name}`, () => {
      const json = createTableSchema(definition).toJSON();
      expect(jsonSafetyViolations(json)).toEqual([]);
    });
  }

  it("stores timerange presets as strings, not Dates", () => {
    const json = createTableSchema(adversarialSchema).toJSON();
    const window = json.columns.find((c) => c.key === "window")!;
    for (const preset of window.filter?.presets ?? []) {
      expect(typeof preset.from).toBe("string");
      expect(typeof preset.to).toBe("string");
      expect(new Date(preset.from).toISOString()).toBe(preset.from);
    }
  });

  it("stores an omitted middle preset argument as null, not undefined", () => {
    // `undefined` inside an array does not survive JSON.stringify — it becomes
    // `null` and the emitted TypeScript would change meaning.
    const json = createTableSchema({
      latency: presets.latency(undefined, { min: 0, max: 60 }),
    }).toJSON();
    const provenance = json.columns[0]!.provenance;
    expect(provenance).toEqual({
      source: "preset",
      preset: "latency",
      args: [null, { min: 0, max: 60 }],
    });
    expect(jsonSafetyViolations(json)).toEqual([]);
  });

  it("keeps JSON.stringify(schema) working through toJSON()", () => {
    const schema = createTableSchema(logsSchema);
    expect(JSON.parse(JSON.stringify(schema))).toEqual(schema.toJSON());
  });
});

// ── Migration ───────────────────────────────────────────────────────────────

/** A payload in the shape the pre-descriptor serializer wrote. */
function v0Payload(): unknown {
  return {
    columns: [
      {
        key: "select",
        label: "Select",
        dataType: "select",
        optional: false,
        hidden: false,
        enableHiding: false,
        sortable: false,
        size: 37,
        display: { type: "boolean" },
        filter: null,
        sheet: null,
      },
      {
        key: "level",
        label: "Level",
        description: "Log severity",
        dataType: "enum",
        enumValues: ["success", "warning", "error"],
        optional: false,
        hidden: false,
        hideHeader: true,
        sortable: false,
        size: 37,
        display: { type: "badge" },
        filter: {
          type: "checkbox",
          defaultOpen: true,
          commandDisabled: false,
          options: [
            { label: "success", value: "success" },
            { label: "warning", value: "warning" },
            { label: "error", value: "error" },
          ],
        },
        sheet: null,
      },
      {
        key: "date",
        label: "Date",
        dataType: "timestamp",
        optional: false,
        hidden: false,
        sortable: true,
        size: 200,
        display: { type: "timestamp" },
        filter: { type: "timerange", defaultOpen: true, commandDisabled: true },
        sheet: { skeletonClassName: "w-36" },
      },
      {
        key: "latency",
        label: "Latency",
        dataType: "number",
        optional: false,
        hidden: false,
        sortable: true,
        size: 110,
        display: { type: "number", unit: "ms" },
        filter: {
          type: "slider",
          defaultOpen: false,
          commandDisabled: false,
          min: 0,
          max: 5000,
          unit: "ms",
        },
        sheet: {},
      },
      {
        key: "regions",
        label: "Regions",
        dataType: "array",
        arrayItemType: { dataType: "enum", enumValues: ["ams", "fra"] },
        optional: false,
        hidden: false,
        sortable: false,
        display: { type: "badge" },
        filter: {
          type: "checkbox",
          defaultOpen: false,
          commandDisabled: false,
          options: [
            { label: "ams", value: "ams" },
            { label: "fra", value: "fra" },
          ],
        },
        sheet: null,
      },
      {
        key: "headers",
        label: "Headers",
        dataType: "record",
        optional: false,
        // The v0 shape of `.sheetOnly()`.
        hidden: true,
        enableHiding: false,
        sortable: false,
        display: { type: "text" },
        filter: null,
        sheet: { className: "flex-col items-start w-full gap-1" },
      },
      {
        key: "message",
        label: "Message",
        dataType: "string",
        optional: true,
        hidden: true,
        enableHiding: false,
        sortable: false,
        display: { type: "text" },
        filter: null,
        sheet: {},
      },
    ],
  };
}

describe("migrateSchemaJSON", () => {
  it("migrates a realistic v0 payload to a valid v1", () => {
    const migrated = migrateSchemaJSON(v0Payload());

    expect(migrated.version).toBe(SCHEMA_JSON_VERSION);
    expect(migrated.columns.map((c) => c.key)).toEqual([
      "select",
      "level",
      "date",
      "latency",
      "regions",
      "headers",
      "message",
    ]);

    // `dataType` → `kind`, and the old key is gone.
    expect(migrated.columns.map((c) => c.kind)).toEqual([
      "select",
      "enum",
      "timestamp",
      "number",
      "array",
      "record",
      "string",
    ]);
    for (const c of migrated.columns) {
      expect(c).not.toHaveProperty("dataType");
      expect(c).not.toHaveProperty("arrayItemType");
      // Newly-required fields get their defaults, always present.
      expect(c.resizable).toBe(false);
      expect(typeof c.enableHiding).toBe("boolean");
      expect(typeof c.hideHeader).toBe("boolean");
      expect(c.provenance).toEqual({ source: "manual" });
    }

    // `arrayItemType` → recursive `arrayItem`.
    const regions = migrated.columns.find((c) => c.key === "regions")!;
    expect(regions.kind === "array" && regions.arrayItem).toMatchObject({
      kind: "enum",
      enumValues: ["ams", "fra"],
      display: { type: "badge" },
    });

    // Fields v0 already carried are preserved verbatim.
    expect(migrated.columns.find((c) => c.key === "latency")).toMatchObject({
      display: { type: "number", unit: "ms" },
      filter: { type: "slider", min: 0, max: 5000, unit: "ms" },
      size: 110,
      sortable: true,
    });
    expect(migrated.columns.find((c) => c.key === "level")).toMatchObject({
      description: "Log severity",
      hideHeader: true,
      enumValues: ["success", "warning", "error"],
      filter: { defaultOpen: true },
    });
  });

  it("produces something deserializeSchema accepts and createTableSchema validates", () => {
    const migrated = migrateSchemaJSON(v0Payload());
    const definition = deserializeSchema(migrated);
    expect(() => createTableSchema(definition)).not.toThrow();
    // The migrated schema is itself a v1 fixed point.
    expect(serializeSchema(definition)).toEqual(migrated);
    expectRoundTripsToOriginal(definition);
  });

  it("keeps a v0 enableHiding:false + hidden:true column sheet-only shaped", () => {
    const migrated = migrateSchemaJSON(v0Payload());
    for (const key of ["headers", "message"]) {
      expect(
        migrated.columns.find((c) => c.key === key),
        key,
      ).toMatchObject({
        hidden: true,
        enableHiding: false,
        filter: null,
      });
    }
    // ...and the shape survives reconstruction.
    const definition = deserializeSchema(migrated);
    expect(column(definition, "headers")).toMatchObject({
      hidden: true,
      enableHiding: false,
      filter: null,
    });
  });

  it("does not turn a v0 enableHiding:false + hidden:false column into a sheet-only one", () => {
    const migrated = migrateSchemaJSON(v0Payload());
    expect(migrated.columns.find((c) => c.key === "select")).toMatchObject({
      hidden: false,
      enableHiding: false,
    });
  });

  it("defaults enableHiding to true when v0 omitted it", () => {
    const migrated = migrateSchemaJSON(v0Payload());
    expect(migrated.columns.find((c) => c.key === "date")?.enableHiding).toBe(
      true,
    );
  });

  it("passes a v1 payload through unchanged", () => {
    // Not an identity check: v1 payloads are re-normalized too, because
    // `fromJSON` accepts user-typed text and "it says version 1" is not
    // evidence that its columns are well-formed. The law is that
    // normalization is a no-op on well-formed v1 input.
    for (const definition of [logsSchema, presetsSchema, adversarialSchema]) {
      const v1 = serializeSchema(definition);
      expect(migrateSchemaJSON(v1)).toEqual(v1);
      // ...and idempotent.
      expect(migrateSchemaJSON(migrateSchemaJSON(v1))).toEqual(v1);
      // ...including after an actual trip through the wire.
      expect(migrateSchemaJSON(JSON.parse(JSON.stringify(v1)))).toEqual(v1);
    }
  });

  it("passes an inferred v1 payload through unchanged", () => {
    const inferred = inferSchemaFromJSON(MANY_TAG_ROWS);
    expect(migrateSchemaJSON(inferred)).toEqual(inferred);
  });

  it("throws a useful message on non-object input", () => {
    for (const bad of [null, undefined, 42, "columns", true, () => null]) {
      expect(() => migrateSchemaJSON(bad)).toThrowError(
        /Expected an object with a `columns` array/,
      );
    }
  });

  it("throws a useful message on a missing or non-array `columns`", () => {
    expect(() => migrateSchemaJSON({})).toThrowError(
      /Expected an object with a `columns` array/,
    );
    expect(() => migrateSchemaJSON({ version: 1 })).toThrowError(
      /Expected an object with a `columns` array/,
    );
    expect(() =>
      migrateSchemaJSON({ version: 1, columns: { host: {} } }),
    ).toThrowError(/Expected an object with a `columns` array/);
    // An array at the top level is not a schema either.
    expect(() => migrateSchemaJSON([])).toThrowError(
      /Expected an object with a `columns` array/,
    );
  });

  it("throws a useful message on an unknown version", () => {
    expect(() => migrateSchemaJSON({ version: 99, columns: [] })).toThrowError(
      /Unknown schema version 99/,
    );
    expect(() => migrateSchemaJSON({ version: 99, columns: [] })).toThrowError(
      /understands version 1/,
    );
    // The string "1" is not version 1. The message quotes the value so the
    // two are distinguishable — `String("1")` would have read as `1` and made
    // the error look like a contradiction.
    expect(() => migrateSchemaJSON({ version: "1", columns: [] })).toThrowError(
      /Unknown schema version "1"/,
    );
  });

  it("falls back to `string` for an unrecognised v0 dataType", () => {
    const migrated = migrateSchemaJSON({
      columns: [{ key: "weird", label: "Weird", dataType: "quaternion" }],
    });
    expect(migrated.columns[0]).toMatchObject({
      kind: "string",
      display: { type: "text" },
    });
  });
});

describe("createTableSchema.fromJSON", () => {
  it("accepts a v0 payload end to end", () => {
    const schema = createTableSchema.fromJSON(v0Payload());
    const json = schema.toJSON();

    expect(json.version).toBe(SCHEMA_JSON_VERSION);
    expect(Object.keys(schema.definition)).toEqual([
      "select",
      "level",
      "date",
      "latency",
      "regions",
      "headers",
      "message",
    ]);
    expect(json).toEqual(migrateSchemaJSON(v0Payload()));
    expect(jsonSafetyViolations(json)).toEqual([]);
  });

  it("accepts a v1 payload end to end and reproduces it", () => {
    const v1 = createTableSchema(logsSchema).toJSON();
    expect(createTableSchema.fromJSON(v1).toJSON()).toEqual(v1);
  });

  it("accepts JSON produced by inferSchemaFromJSON", () => {
    const inferred = inferSchemaFromJSON(MANY_TAG_ROWS);
    const schema = createTableSchema.fromJSON(inferred);
    expect(schema.toJSON()).toEqual(inferred);
  });

  it("propagates migration errors instead of building a broken schema", () => {
    expect(() => createTableSchema.fromJSON("not a schema")).toThrowError(
      /Expected an object with a `columns` array/,
    );
    expect(() =>
      createTableSchema.fromJSON({ version: 99, columns: [] }),
    ).toThrowError(/Unknown schema version 99/);
  });

  it("still validates the reconstructed schema", () => {
    expect(() =>
      createTableSchema.fromJSON({
        columns: [{ key: "host", dataType: "string" }],
      }),
    ).toThrowError(/missing a label/);
  });
});

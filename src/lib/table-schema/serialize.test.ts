import { describe, expect, it } from "vitest";
import { col } from "./col";
import { deserializeSchema, serializeSchema } from "./serialize";
import type { SchemaJSON } from "./types";

// ── serializeSchema ──────────────────────────────────────────────────────────

describe("serializeSchema", () => {
  it("serializes a string column with defaults", () => {
    const json = serializeSchema({ host: col.string().label("Host") });
    expect(json.columns).toHaveLength(1);
    expect(json.columns[0]).toMatchObject({
      key: "host",
      label: "Host",
      dataType: "string",
      optional: false,
      hidden: false,
      sortable: false,
      display: { type: "text" },
      filter: { type: "input", defaultOpen: false, commandDisabled: false },
      sheet: null,
    });
  });

  it("serializes a number column with slider filter (min/max)", () => {
    const json = serializeSchema({
      latency: col
        .number()
        .label("Latency")
        .filterable("slider", { min: 0, max: 5000 }),
    });
    expect(json.columns[0]?.filter).toMatchObject({
      type: "slider",
      min: 0,
      max: 5000,
    });
  });

  it("serializes number display with unit", () => {
    const json = serializeSchema({
      latency: col.number().label("Latency").display("number", { unit: "ms" }),
    });
    expect(json.columns[0]?.display).toEqual({ type: "number", unit: "ms" });
  });

  it("serializes an enum column with enumValues and checkbox options", () => {
    const LEVELS = ["error", "warn", "info"] as const;
    const json = serializeSchema({
      level: col
        .enum(LEVELS)
        .label("Level")
        .filterable("checkbox", {
          options: LEVELS.map((v) => ({ label: v, value: v })),
        }),
    });
    const c = json.columns[0]!;
    expect(c.dataType).toBe("enum");
    expect(c.enumValues).toEqual(["error", "warn", "info"]);
    expect(c.filter?.options).toEqual([
      { label: "error", value: "error" },
      { label: "warn", value: "warn" },
      { label: "info", value: "info" },
    ]);
  });

  it("serializes an array(enum) column with arrayItemType", () => {
    const REGIONS = ["us-east-1", "eu-west-1"] as const;
    const json = serializeSchema({
      regions: col.array(col.enum(REGIONS)).label("Regions"),
    });
    const c = json.columns[0]!;
    expect(c.dataType).toBe("array");
    expect(c.arrayItemType).toMatchObject({
      dataType: "enum",
      enumValues: ["us-east-1", "eu-west-1"],
    });
  });

  it("serializes a boolean column with pre-wired Yes/No options", () => {
    const json = serializeSchema({ active: col.boolean().label("Active") });
    const c = json.columns[0]!;
    expect(c.dataType).toBe("boolean");
    expect(c.display).toEqual({ type: "boolean" });
    expect(c.filter?.type).toBe("checkbox");
    expect(c.filter?.options).toEqual([
      { label: "Yes", value: true },
      { label: "No", value: false },
    ]);
  });

  it("serializes a timestamp column", () => {
    const json = serializeSchema({ date: col.timestamp().label("Date") });
    const c = json.columns[0]!;
    expect(c.dataType).toBe("timestamp");
    expect(c.display).toEqual({ type: "timestamp" });
    expect(c.filter?.type).toBe("timerange");
  });

  it("serializes a record column with filter: null", () => {
    const json = serializeSchema({
      headers: col.record().label("Headers"),
    });
    const c = json.columns[0]!;
    expect(c.dataType).toBe("record");
    expect(c.filter).toBeNull();
  });

  it("serializes description", () => {
    const json = serializeSchema({
      host: col
        .string()
        .label("Host")
        .description("The origin server hostname"),
    });
    expect(json.columns[0]?.description).toBe("The origin server hostname");
  });

  it("serializes hidden, sortable, optional, size", () => {
    const json = serializeSchema({
      id: col.string().label("ID").hidden().sortable().optional().size(120),
    });
    expect(json.columns[0]).toMatchObject({
      hidden: true,
      sortable: true,
      optional: true,
      size: 120,
    });
  });

  it("serializes filter: null for notFilterable columns", () => {
    const json = serializeSchema({
      id: col.string().label("ID").notFilterable(),
    });
    expect(json.columns[0]?.filter).toBeNull();
  });

  it("serializes defaultOpen and commandDisabled on the filter", () => {
    const json = serializeSchema({
      level: col
        .string()
        .label("Level")
        .filterable("input")
        .defaultOpen()
        .commandDisabled(),
    });
    expect(json.columns[0]?.filter).toMatchObject({
      defaultOpen: true,
      commandDisabled: true,
    });
  });

  it("serializes sheet with label and className", () => {
    const json = serializeSchema({
      host: col
        .string()
        .label("Host")
        .sheet({ label: "Origin", className: "flex-col" }),
    });
    expect(json.columns[0]?.sheet).toMatchObject({
      label: "Origin",
      className: "flex-col",
    });
  });

  it("serializes an empty sheet (no config) as an empty object", () => {
    const json = serializeSchema({
      host: col.string().label("Host").sheet(),
    });
    expect(json.columns[0]?.sheet).toEqual({});
  });

  it("strips sheet.component and sheet.condition (functions) from output", () => {
    const json = serializeSchema({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      host: (col.string().label("Host") as any).sheet({
        component: () => null,
        condition: () => true,
      }),
    });
    expect(json.columns[0]?.sheet).not.toHaveProperty("component");
    expect(json.columns[0]?.sheet).not.toHaveProperty("condition");
  });

  it("returns a columns array in insertion order", () => {
    const json = serializeSchema({
      a: col.string().label("A"),
      b: col.string().label("B"),
      c: col.string().label("C"),
    });
    expect(json.columns.map((c) => c.key)).toEqual(["a", "b", "c"]);
  });
});

// ── deserializeSchema ────────────────────────────────────────────────────────

describe("deserializeSchema", () => {
  /** Serialize → deserialize → serialize again and compare to the original JSON. */
  function roundTrip(def: Parameters<typeof serializeSchema>[0]): SchemaJSON {
    return serializeSchema(deserializeSchema(serializeSchema(def)));
  }

  it("round-trips a string column", () => {
    const def = { host: col.string().label("Host") };
    expect(roundTrip(def)).toEqual(serializeSchema(def));
  });

  it("round-trips a number column with slider", () => {
    const def = {
      latency: col
        .number()
        .label("Latency")
        .filterable("slider", { min: 0, max: 5000 }),
    };
    expect(roundTrip(def)).toEqual(serializeSchema(def));
  });

  it("round-trips a number column with unit display", () => {
    const def = {
      latency: col.number().label("Latency").display("number", { unit: "ms" }),
    };
    expect(roundTrip(def)).toEqual(serializeSchema(def));
  });

  it("round-trips an enum column with checkbox options", () => {
    const LEVELS = ["error", "warn", "info"] as const;
    const def = {
      level: col
        .enum(LEVELS)
        .label("Level")
        .filterable("checkbox", {
          options: LEVELS.map((v) => ({ label: v, value: v })),
        }),
    };
    expect(roundTrip(def)).toEqual(serializeSchema(def));
  });

  it("round-trips an array(enum) column", () => {
    const REGIONS = ["us-east-1", "eu-west-1"] as const;
    const def = {
      regions: col
        .array(col.enum(REGIONS))
        .label("Regions")
        .filterable("checkbox", {
          options: REGIONS.map((r) => ({ label: r, value: r })),
        }),
    };
    expect(roundTrip(def)).toEqual(serializeSchema(def));
  });

  it("round-trips a boolean column", () => {
    const def = { active: col.boolean().label("Active").defaultOpen() };
    expect(roundTrip(def)).toEqual(serializeSchema(def));
  });

  it("round-trips a timestamp column", () => {
    const def = { date: col.timestamp().label("Date").sortable() };
    expect(roundTrip(def)).toEqual(serializeSchema(def));
  });

  it("round-trips a record column", () => {
    const def = { headers: col.record().label("Headers").hidden() };
    expect(roundTrip(def)).toEqual(serializeSchema(def));
  });

  it("round-trips description", () => {
    const def = {
      host: col.string().label("Host").description("The origin server"),
    };
    expect(roundTrip(def)).toEqual(serializeSchema(def));
  });

  it("round-trips hidden / sortable / optional / size", () => {
    const def = {
      id: col.string().label("ID").hidden().sortable().optional().size(120),
    };
    expect(roundTrip(def)).toEqual(serializeSchema(def));
  });

  it("round-trips notFilterable (filter: null)", () => {
    const def = { id: col.string().label("ID").notFilterable() };
    expect(roundTrip(def)).toEqual(serializeSchema(def));
  });

  it("round-trips defaultOpen and commandDisabled", () => {
    const def = {
      level: col.string().label("Level").defaultOpen().commandDisabled(),
    };
    expect(roundTrip(def)).toEqual(serializeSchema(def));
  });

  it("round-trips a sheet with label and className", () => {
    const def = {
      host: col
        .string()
        .label("Host")
        .sheet({ label: "Origin", skeletonClassName: "w-24" }),
    };
    expect(roundTrip(def)).toEqual(serializeSchema(def));
  });

  it("falls back to 'badge' display for enum when JSON has display.type 'custom'", () => {
    const json: SchemaJSON = {
      columns: [
        {
          key: "level",
          label: "Level",
          dataType: "enum",
          enumValues: ["error", "info"],
          optional: false,
          hidden: false,
          sortable: false,
          display: { type: "custom" },
          filter: {
            type: "checkbox",
            defaultOpen: false,
            commandDisabled: false,
          },
          sheet: null,
        },
      ],
    };
    const out = serializeSchema(deserializeSchema(json));
    expect(out.columns[0]?.display.type).toBe("badge");
  });

  it("falls back to 'text' display for string when JSON has display.type 'custom'", () => {
    const json: SchemaJSON = {
      columns: [
        {
          key: "host",
          label: "Host",
          dataType: "string",
          optional: false,
          hidden: false,
          sortable: false,
          display: { type: "custom" },
          filter: { type: "input", defaultOpen: false, commandDisabled: false },
          sheet: null,
        },
      ],
    };
    const out = serializeSchema(deserializeSchema(json));
    expect(out.columns[0]?.display.type).toBe("text");
  });
});

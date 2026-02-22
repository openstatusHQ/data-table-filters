import { describe, expect, it } from "vitest";
import { col } from "./col";
import { createTableSchema, getDefaultColumnVisibility } from "./index";
import type { SchemaJSON } from "./types";

// ── createTableSchema ────────────────────────────────────────────────────────

describe("createTableSchema", () => {
  it("returns an object with definition and toJSON", () => {
    const schema = createTableSchema({
      name: col.string().label("Name"),
    });
    expect(schema).toHaveProperty("definition");
    expect(schema).toHaveProperty("toJSON");
    expect(typeof schema.toJSON).toBe("function");
  });

  it("exposes the original definition unchanged", () => {
    const nameCol = col.string().label("Name");
    const schema = createTableSchema({ name: nameCol });
    expect(schema.definition.name).toBe(nameCol);
  });

  it("throws on an invalid schema — missing label", () => {
    expect(() => createTableSchema({ name: col.string() })).toThrowError(
      '"name"',
    );
  });

  it("throws on an invalid schema — slider min > max", () => {
    expect(() =>
      createTableSchema({
        latency: col
          .number()
          .label("Latency")
          .filterable("slider", { min: 100, max: 10 }),
      }),
    ).toThrowError("slider min (100) must be less than max (10)");
  });

  it("toJSON() returns a valid SchemaJSON", () => {
    const schema = createTableSchema({
      host: col.string().label("Host"),
    });
    const json = schema.toJSON();
    expect(json).toHaveProperty("columns");
    expect(Array.isArray(json.columns)).toBe(true);
    expect(json.columns[0]?.key).toBe("host");
  });

  it("JSON.stringify(schema) calls toJSON() automatically", () => {
    const schema = createTableSchema({
      host: col.string().label("Host"),
    });
    const parsed = JSON.parse(JSON.stringify(schema)) as SchemaJSON;
    expect(parsed).toHaveProperty("columns");
    expect(parsed.columns[0]?.key).toBe("host");
  });
});

// ── createTableSchema.fromJSON ───────────────────────────────────────────────

describe("createTableSchema.fromJSON", () => {
  it("reconstructs a schema and toJSON() matches the original", () => {
    const original = createTableSchema({
      host: col.string().label("Host"),
      latency: col
        .number()
        .label("Latency")
        .filterable("slider", { min: 0, max: 5000 }),
    });
    const json = original.toJSON();
    const restored = createTableSchema.fromJSON(json);
    expect(restored.toJSON()).toEqual(json);
  });

  it("round-trips enum columns", () => {
    const LEVELS = ["error", "warn", "info"] as const;
    const original = createTableSchema({
      level: col
        .enum(LEVELS)
        .label("Level")
        .filterable("checkbox", {
          options: LEVELS.map((v) => ({ label: v, value: v })),
        }),
    });
    const restored = createTableSchema.fromJSON(original.toJSON());
    expect(restored.toJSON()).toEqual(original.toJSON());
  });

  it("throws when JSON produces an invalid schema (empty label)", () => {
    const badJSON: SchemaJSON = {
      columns: [
        {
          key: "host",
          label: "",
          dataType: "string",
          optional: false,
          hidden: false,
          sortable: false,
          display: { type: "text" },
          filter: { type: "input", defaultOpen: false, commandDisabled: false },
          sheet: null,
        },
      ],
    };
    expect(() => createTableSchema.fromJSON(badJSON)).toThrow();
  });

  it("returns a schema with a working toJSON method", () => {
    const json: SchemaJSON = {
      columns: [
        {
          key: "active",
          label: "Active",
          dataType: "boolean",
          optional: false,
          hidden: false,
          sortable: false,
          display: { type: "boolean" },
          filter: {
            type: "checkbox",
            defaultOpen: false,
            commandDisabled: false,
          },
          sheet: null,
        },
      ],
    };
    const schema = createTableSchema.fromJSON(json);
    expect(schema.toJSON().columns[0]?.label).toBe("Active");
  });
});

// ── getDefaultColumnVisibility ───────────────────────────────────────────────

describe("getDefaultColumnVisibility", () => {
  it("returns an empty object when no columns are hidden", () => {
    const schema = createTableSchema({
      name: col.string().label("Name"),
      count: col.number().label("Count"),
    });
    expect(getDefaultColumnVisibility(schema.definition)).toEqual({});
  });

  it("returns { key: false } for every hidden column", () => {
    const schema = createTableSchema({
      name: col.string().label("Name"),
      id: col.string().label("ID").hidden(),
      traceId: col.string().label("Trace ID").hidden().notFilterable(),
    });
    expect(getDefaultColumnVisibility(schema.definition)).toEqual({
      id: false,
      traceId: false,
    });
  });

  it("does not include visible columns in the result", () => {
    const schema = createTableSchema({
      name: col.string().label("Name"),
      id: col.string().label("ID").hidden(),
    });
    const visibility = getDefaultColumnVisibility(schema.definition);
    expect(visibility).not.toHaveProperty("name");
  });

  it("returns an empty object for an empty schema", () => {
    expect(getDefaultColumnVisibility({})).toEqual({});
  });
});

import {
  ARRAY_DELIMITER,
  RANGE_DELIMITER,
  SLIDER_DELIMITER,
} from "@dtf/registry/lib/delimiters";
import { describe, expect, it } from "vitest";
import { col } from "../col";
import type { TableSchemaDefinition } from "../types";
import { generateFilterSchema } from "./filter-schema";

// ── generateFilterSchema ─────────────────────────────────────────────────────

describe("generateFilterSchema", () => {
  it("returns empty schema for empty definition", () => {
    const result = generateFilterSchema({});
    expect(Object.keys(result.definition)).toHaveLength(0);
  });

  it("excludes non-filterable columns", () => {
    const schema: TableSchemaDefinition = {
      id: col.string().label("ID").notFilterable(),
      name: col.string().label("Name").filterable("input"),
    };
    const result = generateFilterSchema(schema);
    expect(result.definition.id).toBeUndefined();
    expect(result.definition.name).toBeDefined();
  });

  it("string + input → field.string()", () => {
    const schema: TableSchemaDefinition = {
      path: col.string().label("Path").filterable("input"),
    };
    const result = generateFilterSchema(schema);
    const field = result.definition.path;
    expect(field).toBeDefined();
    expect(field._config.type).toBe("string");
  });

  it("number + input → field.number()", () => {
    const schema: TableSchemaDefinition = {
      count: col.number().label("Count").filterable("input"),
    };
    const result = generateFilterSchema(schema);
    const field = result.definition.count;
    expect(field).toBeDefined();
    expect(field._config.type).toBe("number");
  });

  it("number + slider → field.array(field.number()) with SLIDER_DELIMITER", () => {
    const schema: TableSchemaDefinition = {
      latency: col
        .number()
        .label("Latency")
        .filterable("slider", { min: 0, max: 5000 }),
    };
    const result = generateFilterSchema(schema);
    const field = result.definition.latency;
    expect(field).toBeDefined();
    expect(field._config.type).toBe("array");
    expect(field._config.delimiter).toBe(SLIDER_DELIMITER);
  });

  it("number + checkbox → field.array(field.number()) with ARRAY_DELIMITER", () => {
    const schema: TableSchemaDefinition = {
      status: col
        .number()
        .label("Status")
        .filterable("checkbox", {
          options: [{ label: "200", value: 200 }],
        }),
    };
    const result = generateFilterSchema(schema);
    const field = result.definition.status;
    expect(field).toBeDefined();
    expect(field._config.type).toBe("array");
    expect(field._config.delimiter).toBe(ARRAY_DELIMITER);
  });

  it("boolean + checkbox → field.array(field.boolean()) with ARRAY_DELIMITER", () => {
    const schema: TableSchemaDefinition = {
      active: col.boolean().label("Active"),
    };
    const result = generateFilterSchema(schema);
    const field = result.definition.active;
    expect(field).toBeDefined();
    expect(field._config.type).toBe("array");
    expect(field._config.delimiter).toBe(ARRAY_DELIMITER);
  });

  it("timestamp + timerange → field.array(field.timestamp()) with RANGE_DELIMITER", () => {
    const schema: TableSchemaDefinition = {
      date: col.timestamp().label("Date").filterable("timerange"),
    };
    const result = generateFilterSchema(schema);
    const field = result.definition.date;
    expect(field).toBeDefined();
    expect(field._config.type).toBe("array");
    expect(field._config.delimiter).toBe(RANGE_DELIMITER);
  });

  it("enum + checkbox → field.array(field.stringLiteral(values))", () => {
    const LEVELS = ["error", "warn", "info"] as const;
    const schema: TableSchemaDefinition = {
      level: col.enum(LEVELS).label("Level").filterable("checkbox"),
    };
    const result = generateFilterSchema(schema);
    const field = result.definition.level;
    expect(field).toBeDefined();
    expect(field._config.type).toBe("array");
  });

  it("array(enum) + checkbox → field.array(field.stringLiteral(values))", () => {
    const REGIONS = ["us-east", "us-west"] as const;
    const schema: TableSchemaDefinition = {
      regions: col
        .array(col.enum(REGIONS))
        .label("Regions")
        .filterable("checkbox"),
    };
    const result = generateFilterSchema(schema);
    const field = result.definition.regions;
    expect(field).toBeDefined();
    expect(field._config.type).toBe("array");
  });

  it("returns a valid createSchema result with definition property", () => {
    const LEVELS = ["error", "warn"] as const;
    const schema: TableSchemaDefinition = {
      level: col.enum(LEVELS).label("Level").filterable("checkbox"),
      path: col.string().label("Path").filterable("input"),
      latency: col
        .number()
        .label("Latency")
        .filterable("slider", { min: 0, max: 100 }),
    };
    const result = generateFilterSchema(schema);
    expect(result).toHaveProperty("definition");
    expect(Object.keys(result.definition)).toEqual([
      "level",
      "path",
      "latency",
    ]);
  });

  it("handles a comprehensive schema with all filter types", () => {
    const LEVELS = ["error", "warn", "info"] as const;
    const schema: TableSchemaDefinition = {
      level: col.enum(LEVELS).label("Level").filterable("checkbox"),
      path: col.string().label("Path").filterable("input"),
      latency: col
        .number()
        .label("Latency")
        .filterable("slider", { min: 0, max: 5000 }),
      status: col
        .number()
        .label("Status")
        .filterable("checkbox", {
          options: [{ label: "200", value: 200 }],
        }),
      date: col.timestamp().label("Date").filterable("timerange"),
      active: col.boolean().label("Active"),
      host: col.string().label("Host").notFilterable(),
    };
    const result = generateFilterSchema(schema);
    // host is not filterable → excluded
    expect(Object.keys(result.definition)).toEqual([
      "level",
      "path",
      "latency",
      "status",
      "date",
      "active",
    ]);
  });
});

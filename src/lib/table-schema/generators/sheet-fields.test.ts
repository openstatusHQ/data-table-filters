import { describe, expect, it } from "vitest";
import { col } from "../col";
import type { TableSchemaDefinition } from "../types";
import { generateSheetFields } from "./sheet-fields";

// ── generateSheetFields ──────────────────────────────────────────────────────

describe("generateSheetFields", () => {
  it("returns empty array for empty schema", () => {
    expect(generateSheetFields({})).toEqual([]);
  });

  it("excludes columns without .sheet() called", () => {
    const schema: TableSchemaDefinition = {
      id: col.string().label("ID"),
      name: col.string().label("Name").sheet(),
    };
    const fields = generateSheetFields(schema);
    expect(fields).toHaveLength(1);
    expect(fields[0].id).toBe("name");
  });

  it("derives type from filter type", () => {
    const schema: TableSchemaDefinition = {
      path: col.string().label("Path").filterable("input").sheet(),
      level: col.enum(["a", "b"] as const).label("Level").filterable("checkbox").sheet(),
      latency: col.number().label("Latency").filterable("slider", { min: 0, max: 100 }).sheet(),
      date: col.timestamp().label("Date").filterable("timerange").sheet(),
    };
    const fields = generateSheetFields(schema);
    expect(fields.find((f) => f.id === "path")?.type).toBe("input");
    expect(fields.find((f) => f.id === "level")?.type).toBe("checkbox");
    expect(fields.find((f) => f.id === "latency")?.type).toBe("slider");
    expect(fields.find((f) => f.id === "date")?.type).toBe("timerange");
  });

  it("uses 'readonly' type when column is not filterable", () => {
    const schema: TableSchemaDefinition = {
      traceId: col.string().label("Trace ID").notFilterable().sheet(),
    };
    const [field] = generateSheetFields(schema);
    expect(field.type).toBe("readonly");
  });

  it("uses sheet label when overridden, falls back to column label", () => {
    const schema: TableSchemaDefinition = {
      id: col.string().label("ID").sheet({ label: "Request ID" }),
      name: col.string().label("Name").sheet(),
    };
    const fields = generateSheetFields(schema);
    expect(fields.find((f) => f.id === "id")?.label).toBe("Request ID");
    expect(fields.find((f) => f.id === "name")?.label).toBe("Name");
  });

  it("passes through className and skeletonClassName", () => {
    const schema: TableSchemaDefinition = {
      id: col.string().label("ID").sheet({
        className: "font-mono",
        skeletonClassName: "w-64",
      }),
    };
    const [field] = generateSheetFields(schema);
    expect(field.className).toBe("font-mono");
    expect(field.skeletonClassName).toBe("w-64");
  });

  it("preserves schema definition order", () => {
    const schema: TableSchemaDefinition = {
      alpha: col.string().label("Alpha").sheet(),
      beta: col.string().label("Beta").sheet(),
      gamma: col.string().label("Gamma").sheet(),
    };
    const fields = generateSheetFields(schema);
    expect(fields.map((f) => f.id)).toEqual(["alpha", "beta", "gamma"]);
  });

  it("includes only sheet-enabled columns in mixed schema", () => {
    const schema: TableSchemaDefinition = {
      id: col.string().label("ID").sheet(),
      level: col.enum(["a"] as const).label("Level"),
      path: col.string().label("Path").sheet(),
      host: col.string().label("Host"),
    };
    const fields = generateSheetFields(schema);
    expect(fields.map((f) => f.id)).toEqual(["id", "path"]);
  });
});

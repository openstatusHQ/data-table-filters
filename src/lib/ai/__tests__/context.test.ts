import { col, createTableSchema } from "@/lib/table-schema";
import { describe, expect, it } from "vitest";
import { generateAIContext } from "../context";
import { testSchema } from "./test-schema";

describe("generateAIContext", () => {
  const ctx = generateAIContext(testSchema.definition);

  it("returns all filterable fields including commandDisabled", () => {
    const keys = ctx.fields.map((f) => f.key);
    expect(keys).toContain("level");
    expect(keys).toContain("host");
    expect(keys).toContain("latency");
    expect(keys).toContain("regions");
    expect(keys).toContain("status");
    expect(keys).toContain("date"); // commandDisabled is ignored for AI
    // message is not filterable
    expect(keys).not.toContain("message");
  });

  it("includes labels", () => {
    const level = ctx.fields.find((f) => f.key === "level")!;
    expect(level.label).toBe("Level");
  });

  it("includes descriptions when set", () => {
    const level = ctx.fields.find((f) => f.key === "level")!;
    expect(level.description).toBe("Log severity level");

    const host = ctx.fields.find((f) => f.key === "host")!;
    expect(host.description).toBeUndefined();
  });

  it("extracts allowed values for enum checkbox fields", () => {
    const level = ctx.fields.find((f) => f.key === "level")!;
    expect(level.allowedValues).toEqual(["info", "warn", "error"]);
  });

  it("extracts allowed values for array checkbox fields", () => {
    const regions = ctx.fields.find((f) => f.key === "regions")!;
    expect(regions.allowedValues).toEqual(["ams", "gru", "fra", "iad"]);
  });

  it("extracts min/max for slider fields", () => {
    const latency = ctx.fields.find((f) => f.key === "latency")!;
    expect(latency.min).toBe(0);
    expect(latency.max).toBe(5000);
  });

  it("extracts unit from filter config", () => {
    const latency = ctx.fields.find((f) => f.key === "latency")!;
    expect(latency.unit).toBe("ms");
  });

  it("sets correct filterType per field", () => {
    expect(ctx.fields.find((f) => f.key === "level")!.filterType).toBe(
      "checkbox",
    );
    expect(ctx.fields.find((f) => f.key === "host")!.filterType).toBe("input");
    expect(ctx.fields.find((f) => f.key === "latency")!.filterType).toBe(
      "slider",
    );
    expect(ctx.fields.find((f) => f.key === "regions")!.filterType).toBe(
      "checkbox",
    );
    expect(ctx.fields.find((f) => f.key === "status")!.filterType).toBe(
      "input",
    );
  });

  it("sets correct dataType per field", () => {
    expect(ctx.fields.find((f) => f.key === "level")!.dataType).toBe("enum");
    expect(ctx.fields.find((f) => f.key === "host")!.dataType).toBe("string");
    expect(ctx.fields.find((f) => f.key === "latency")!.dataType).toBe(
      "number",
    );
    expect(ctx.fields.find((f) => f.key === "status")!.dataType).toBe("number");
  });

  it("does not include min/max for non-slider fields", () => {
    const host = ctx.fields.find((f) => f.key === "host")!;
    expect(host.min).toBeUndefined();
    expect(host.max).toBeUndefined();
  });

  it("returns empty fields for schema with no filterable columns", () => {
    const emptySchema = createTableSchema({
      id: col.string().label("ID").notFilterable(),
    });
    const result = generateAIContext(emptySchema.definition);
    expect(result.fields).toEqual([]);
  });
});

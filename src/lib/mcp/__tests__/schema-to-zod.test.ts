import { field } from "@/lib/store/schema";
import { describe, expect, it } from "vitest";
import { schemaToZod } from "../schema-to-zod";

describe("schemaToZod", () => {
  it("converts string field to optional z.string()", () => {
    const schema = { host: field.string() };
    const zod = schemaToZod(schema);
    expect(zod.shape.host).toBeDefined();
    expect(zod.parse({ host: "example.com" })).toEqual({ host: "example.com" });
    expect(zod.parse({})).toEqual({});
  });

  it("converts number field to optional z.number()", () => {
    const schema = { latency: field.number() };
    const zod = schemaToZod(schema);
    expect(zod.parse({ latency: 42 })).toEqual({ latency: 42 });
    expect(zod.parse({})).toEqual({});
  });

  it("converts boolean field to optional z.boolean()", () => {
    const schema = { live: field.boolean() };
    const zod = schemaToZod(schema);
    expect(zod.parse({ live: true })).toEqual({ live: true });
    expect(zod.parse({})).toEqual({});
  });

  it("converts timestamp field to optional z.number() with description", () => {
    const schema = { date: field.timestamp() };
    const zod = schemaToZod(schema);
    expect(zod.parse({ date: 1700000000000 })).toEqual({ date: 1700000000000 });
    expect(zod.parse({})).toEqual({});
    // Should have description
    expect(zod.shape.date.description).toBe("Unix ms");
  });

  it("converts stringLiteral field to optional z.enum()", () => {
    const LEVELS = ["error", "warn", "info"] as const;
    const schema = { level: field.stringLiteral(LEVELS) };
    const zod = schemaToZod(schema);
    expect(zod.parse({ level: "error" })).toEqual({ level: "error" });
    expect(zod.parse({})).toEqual({});
    // Invalid value should fail
    expect(() => zod.parse({ level: "invalid" })).toThrow();
  });

  it("converts array of stringLiteral to optional z.array(z.enum())", () => {
    const REGIONS = ["ams", "fra", "gru"] as const;
    const schema = { regions: field.array(field.stringLiteral(REGIONS)) };
    const zod = schemaToZod(schema);
    expect(zod.parse({ regions: ["ams", "fra"] })).toEqual({
      regions: ["ams", "fra"],
    });
    expect(zod.parse({})).toEqual({});
    expect(() => zod.parse({ regions: ["invalid"] })).toThrow();
  });

  it("converts array of number to optional z.array(z.number())", () => {
    const schema = { latency: field.array(field.number()) };
    const zod = schemaToZod(schema);
    expect(zod.parse({ latency: [100, 500] })).toEqual({
      latency: [100, 500],
    });
    expect(zod.parse({})).toEqual({});
  });

  it("converts array of timestamp to optional z.array(z.number())", () => {
    const schema = { date: field.array(field.timestamp()) };
    const zod = schemaToZod(schema);
    const ts1 = 1700000000000;
    const ts2 = 1700100000000;
    expect(zod.parse({ date: [ts1, ts2] })).toEqual({ date: [ts1, ts2] });
  });

  it("handles multi-field schema", () => {
    const LEVELS = ["error", "warn"] as const;
    const schema = {
      level: field.array(field.stringLiteral(LEVELS)),
      host: field.string(),
      latency: field.array(field.number()).delimiter("-"),
    };
    const zod = schemaToZod(schema);
    const result = zod.parse({
      level: ["error"],
      host: "api.example.com",
      latency: [100, 500],
    });
    expect(result).toEqual({
      level: ["error"],
      host: "api.example.com",
      latency: [100, 500],
    });
  });

  it("converts sort field to optional z.object({ id, desc })", () => {
    const schema = { sort: field.sort() };
    const zod = schemaToZod(schema);
    expect(zod.parse({ sort: { id: "latency", desc: true } })).toEqual({
      sort: { id: "latency", desc: true },
    });
    expect(zod.parse({})).toEqual({});
  });

  it("returns empty object for empty schema", () => {
    const zod = schemaToZod({});
    expect(zod.parse({})).toEqual({});
  });
});

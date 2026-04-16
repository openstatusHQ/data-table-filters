import { describe, expect, it } from "vitest";
import { generateAIOutputSchema } from "../output-schema";
import { testSchema } from "./test-schema";

describe("generateAIOutputSchema", () => {
  const schema = generateAIOutputSchema(testSchema.definition);

  it("returns a zod object schema", () => {
    expect(schema).toBeDefined();
    // Should parse an empty object (all fields optional)
    const result = schema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("includes all filterable fields including commandDisabled", () => {
    const result = schema.safeParse({
      level: ["info", "error"],
      host: "example.com",
      latency: [100, 500],
      regions: ["ams", "fra"],
      status: 200,
      date: ["2026-01-01T00:00:00Z", "2026-01-02T00:00:00Z"],
    });
    expect(result.success).toBe(true);
  });

  it("validates timerange tuple for commandDisabled date field", () => {
    const good = schema.safeParse({
      date: ["2026-01-01T00:00:00Z", "2026-01-02T00:00:00Z"],
    });
    expect(good.success).toBe(true);

    const tooFew = schema.safeParse({ date: ["2026-01-01T00:00:00Z"] });
    expect(tooFew.success).toBe(false);
  });

  it("excludes non-filterable fields (message)", () => {
    const result = schema.safeParse({ message: "hello" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("message");
    }
  });

  it("validates input string fields", () => {
    const good = schema.safeParse({ host: "example.com" });
    expect(good.success).toBe(true);

    const bad = schema.safeParse({ host: 123 });
    expect(bad.success).toBe(false);
  });

  it("validates input number fields", () => {
    const good = schema.safeParse({ status: 200 });
    expect(good.success).toBe(true);

    const bad = schema.safeParse({ status: "200" });
    expect(bad.success).toBe(false);
  });

  it("validates checkbox enum arrays", () => {
    const good = schema.safeParse({ level: ["info", "warn"] });
    expect(good.success).toBe(true);

    const bad = schema.safeParse({ level: ["invalid"] });
    expect(bad.success).toBe(false);
  });

  it("validates slider tuples", () => {
    const good = schema.safeParse({ latency: [100, 500] });
    expect(good.success).toBe(true);

    const badType = schema.safeParse({ latency: ["100", "500"] });
    expect(badType.success).toBe(false);

    const tooFew = schema.safeParse({ latency: [100] });
    expect(tooFew.success).toBe(false);
  });

  it("validates checkbox array for regions", () => {
    const good = schema.safeParse({ regions: ["ams", "fra"] });
    expect(good.success).toBe(true);

    const bad = schema.safeParse({ regions: ["unknown"] });
    expect(bad.success).toBe(false);
  });

  it("all fields are optional", () => {
    const result = schema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("allows partial combinations", () => {
    const result = schema.safeParse({ level: ["error"], latency: [0, 1000] });
    expect(result.success).toBe(true);
  });
});

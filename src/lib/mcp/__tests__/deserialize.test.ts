import { field } from "@/lib/store/schema";
import { describe, expect, it } from "vitest";
import { deserializeFilters } from "../deserialize";

describe("deserializeFilters", () => {
  it("converts timestamp number to Date", () => {
    const schema = { date: field.timestamp() };
    const result = deserializeFilters(schema, { date: 1700000000000 });
    expect(result.date).toBeInstanceOf(Date);
    expect((result.date as Date).getTime()).toBe(1700000000000);
  });

  it("converts array of timestamps to array of Dates", () => {
    const schema = { date: field.array(field.timestamp()) };
    const ts1 = 1700000000000;
    const ts2 = 1700100000000;
    const result = deserializeFilters(schema, { date: [ts1, ts2] });
    expect(Array.isArray(result.date)).toBe(true);
    const dates = result.date as Date[];
    expect(dates[0]).toBeInstanceOf(Date);
    expect(dates[0].getTime()).toBe(ts1);
    expect(dates[1]).toBeInstanceOf(Date);
    expect(dates[1].getTime()).toBe(ts2);
  });

  it("passes through string values", () => {
    const schema = { host: field.string() };
    const result = deserializeFilters(schema, { host: "example.com" });
    expect(result.host).toBe("example.com");
  });

  it("passes through number values", () => {
    const schema = { latency: field.number() };
    const result = deserializeFilters(schema, { latency: 42 });
    expect(result.latency).toBe(42);
  });

  it("passes through boolean values", () => {
    const schema = { live: field.boolean() };
    const result = deserializeFilters(schema, { live: true });
    expect(result.live).toBe(true);
  });

  it("passes through array of strings", () => {
    const LEVELS = ["error", "warn"] as const;
    const schema = { level: field.array(field.stringLiteral(LEVELS)) };
    const result = deserializeFilters(schema, { level: ["error", "warn"] });
    expect(result.level).toEqual(["error", "warn"]);
  });

  it("passes through array of numbers", () => {
    const schema = { latency: field.array(field.number()) };
    const result = deserializeFilters(schema, { latency: [100, 500] });
    expect(result.latency).toEqual([100, 500]);
  });

  it("skips null and undefined values", () => {
    const schema = { host: field.string(), latency: field.number() };
    const result = deserializeFilters(schema, {
      host: null,
      latency: undefined,
    });
    expect(result).toEqual({});
  });

  it("skips keys not in schema", () => {
    const schema = { host: field.string() };
    const result = deserializeFilters(schema, {
      host: "example.com",
      unknown: "value",
    });
    expect(result).toEqual({ host: "example.com" });
    expect(result).not.toHaveProperty("unknown");
  });

  it("handles empty input", () => {
    const schema = { host: field.string() };
    const result = deserializeFilters(schema, {});
    expect(result).toEqual({});
  });
});

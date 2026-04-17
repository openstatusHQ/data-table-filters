import { describe, expect, it } from "vitest";
import { generateAIPrompt } from "../prompt";
import { testSchema } from "./test-schema";

describe("generateAIPrompt", () => {
  it("returns a non-empty string", () => {
    const prompt = generateAIPrompt(testSchema.definition);
    expect(typeof prompt).toBe("string");
    expect(prompt.length).toBeGreaterThan(0);
  });

  it("includes the system instruction", () => {
    const prompt = generateAIPrompt(testSchema.definition);
    expect(prompt).toContain("filter assistant");
    expect(prompt).toContain("natural language query");
  });

  it("includes field keys", () => {
    const prompt = generateAIPrompt(testSchema.definition);
    expect(prompt).toContain("**level**");
    expect(prompt).toContain("**host**");
    expect(prompt).toContain("**latency**");
    expect(prompt).toContain("**regions**");
  });

  it("includes commandDisabled fields (AI ignores commandDisabled)", () => {
    const prompt = generateAIPrompt(testSchema.definition);
    expect(prompt).toContain("**date**");
  });

  it("excludes non-filterable fields", () => {
    const prompt = generateAIPrompt(testSchema.definition);
    expect(prompt).not.toContain("**message**");
  });

  it("includes allowed values for enum fields", () => {
    const prompt = generateAIPrompt(testSchema.definition);
    expect(prompt).toContain('"info"');
    expect(prompt).toContain('"warn"');
    expect(prompt).toContain('"error"');
  });

  it("includes min/max for slider fields", () => {
    const prompt = generateAIPrompt(testSchema.definition);
    expect(prompt).toContain("min: 0");
    expect(prompt).toContain("max: 5000");
  });

  it("includes descriptions", () => {
    const prompt = generateAIPrompt(testSchema.definition);
    expect(prompt).toContain("Log severity level");
    expect(prompt).toContain("Round-trip time in ms");
  });

  it("includes output rules", () => {
    const prompt = generateAIPrompt(testSchema.definition);
    expect(prompt).toContain("## Output rules");
    expect(prompt).toContain("input");
    expect(prompt).toContain("checkbox");
    expect(prompt).toContain("slider");
    expect(prompt).toContain("timerange");
  });

  it("does not include date/time section when now is not provided", () => {
    const prompt = generateAIPrompt(testSchema.definition);
    expect(prompt).not.toContain("## Current date/time");
  });

  it("includes date/time section when now is provided", () => {
    const now = new Date("2026-03-24T12:00:00Z");
    const prompt = generateAIPrompt(testSchema.definition, { now });
    expect(prompt).toContain("## Current date/time");
    expect(prompt).toContain("2026-03-24T12:00:00.000Z");
    expect(prompt).toContain("relative time expressions");
  });
});

import { describe, expect, it } from "vitest";
import { isStructuredQuery } from "../detect";
import { testSchema } from "./test-schema";

const schema = testSchema.definition;

describe("isStructuredQuery", () => {
  // ── Structured queries (should return true) ───────────────────────────────

  it("detects single field:value", () => {
    expect(isStructuredQuery("host:example.com", schema)).toBe(true);
  });

  it("detects field:value with comma-separated values", () => {
    expect(isStructuredQuery("level:info,warn", schema)).toBe(true);
  });

  it("detects field:value with slider range", () => {
    expect(isStructuredQuery("latency:100-500", schema)).toBe(true);
  });

  it("detects multiple field:value pairs", () => {
    expect(isStructuredQuery("host:example.com level:error", schema)).toBe(
      true,
    );
  });

  it("detects structured query with trailing text", () => {
    expect(isStructuredQuery("level:error something else", schema)).toBe(true);
  });

  it("detects structured query with leading text", () => {
    expect(isStructuredQuery("something level:error", schema)).toBe(true);
  });

  it("detects regions field", () => {
    expect(isStructuredQuery("regions:ams,fra", schema)).toBe(true);
  });

  // ── Natural language queries (should return false) ────────────────────────

  it("rejects plain text", () => {
    expect(isStructuredQuery("show me all errors", schema)).toBe(false);
  });

  it("rejects text with colon but no known field", () => {
    expect(isStructuredQuery("error: something went wrong", schema)).toBe(
      false,
    );
  });

  it("rejects empty string", () => {
    expect(isStructuredQuery("", schema)).toBe(false);
  });

  it("rejects whitespace only", () => {
    expect(isStructuredQuery("   ", schema)).toBe(false);
  });

  it("rejects text with unknown field before colon", () => {
    expect(isStructuredQuery("unknown:value", schema)).toBe(false);
  });

  it("rejects natural language with field names as words", () => {
    expect(isStructuredQuery("filter by host name", schema)).toBe(false);
  });

  it("rejects colon at start of token", () => {
    expect(isStructuredQuery(":value", schema)).toBe(false);
  });

  // ── commandDisabled fields ────────────────────────────────────────────────

  it("does not match commandDisabled fields", () => {
    expect(isStructuredQuery("date:2026-01-01", schema)).toBe(false);
  });

  // ── Non-filterable fields ─────────────────────────────────────────────────

  it("does not match non-filterable fields", () => {
    expect(isStructuredQuery("message:hello", schema)).toBe(false);
  });
});

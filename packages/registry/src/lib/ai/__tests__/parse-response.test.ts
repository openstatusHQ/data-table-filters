import { describe, expect, it } from "vitest";
import { parseAIResponse } from "../parse-response";
import { testSchema } from "./test-schema";

const schema = testSchema.definition;

describe("parseAIResponse", () => {
  // ── Empty / null responses ────────────────────────────────────────────────

  it("returns null for empty object", () => {
    expect(parseAIResponse(schema, {})).toBeNull();
  });

  it("returns null when all values are undefined", () => {
    expect(
      parseAIResponse(schema, { host: undefined, level: undefined }),
    ).toBeNull();
  });

  it("returns null when all values are null", () => {
    expect(parseAIResponse(schema, { host: null, level: null })).toBeNull();
  });

  // ── Input fields ──────────────────────────────────────────────────────────

  describe("input (string)", () => {
    it("accepts valid string", () => {
      const result = parseAIResponse(schema, { host: "example.com" });
      expect(result).toEqual({ host: "example.com" });
    });

    it("rejects empty string", () => {
      expect(parseAIResponse(schema, { host: "" })).toBeNull();
    });

    it("rejects non-string value", () => {
      expect(parseAIResponse(schema, { host: 123 })).toBeNull();
    });
  });

  describe("input (number)", () => {
    it("accepts valid number", () => {
      const result = parseAIResponse(schema, { status: 200 });
      expect(result).toEqual({ status: 200 });
    });

    it("rejects string value for number field", () => {
      expect(parseAIResponse(schema, { status: "200" })).toBeNull();
    });
  });

  // ── Checkbox fields ───────────────────────────────────────────────────────

  describe("checkbox", () => {
    it("accepts valid enum values", () => {
      const result = parseAIResponse(schema, { level: ["info", "error"] });
      expect(result).toEqual({ level: ["info", "error"] });
    });

    it("filters out invalid enum values", () => {
      const result = parseAIResponse(schema, {
        level: ["info", "invalid", "error"],
      });
      expect(result).toEqual({ level: ["info", "error"] });
    });

    it("returns null when all values are invalid", () => {
      expect(parseAIResponse(schema, { level: ["invalid"] })).toBeNull();
    });

    it("rejects empty arrays", () => {
      expect(parseAIResponse(schema, { level: [] })).toBeNull();
    });

    it("rejects non-array values", () => {
      expect(parseAIResponse(schema, { level: "info" })).toBeNull();
    });

    it("accepts valid region values", () => {
      const result = parseAIResponse(schema, { regions: ["ams", "fra"] });
      expect(result).toEqual({ regions: ["ams", "fra"] });
    });
  });

  // ── Slider fields ─────────────────────────────────────────────────────────

  describe("slider", () => {
    it("accepts valid range within bounds", () => {
      const result = parseAIResponse(schema, { latency: [100, 500] });
      expect(result).toEqual({ latency: [100, 500] });
    });

    it("clamps min to lower bound", () => {
      const result = parseAIResponse(schema, { latency: [-100, 500] });
      expect(result).toEqual({ latency: [0, 500] });
    });

    it("clamps max to upper bound", () => {
      const result = parseAIResponse(schema, { latency: [100, 10000] });
      expect(result).toEqual({ latency: [100, 5000] });
    });

    it("clamps both bounds", () => {
      const result = parseAIResponse(schema, { latency: [-50, 99999] });
      expect(result).toEqual({ latency: [0, 5000] });
    });

    it("rejects when clamped min > clamped max", () => {
      // After clamping: min=0, max would need to be >= min
      // But if original min > original max and both get clamped badly...
      // e.g., latency: [6000, -1] → clamped [5000, 0] → min > max → rejected
      expect(parseAIResponse(schema, { latency: [6000, -1] })).toBeNull();
    });

    it("rejects non-array", () => {
      expect(parseAIResponse(schema, { latency: 500 })).toBeNull();
    });

    it("rejects array with fewer than 2 elements", () => {
      expect(parseAIResponse(schema, { latency: [100] })).toBeNull();
    });

    it("rejects non-number values in tuple", () => {
      expect(parseAIResponse(schema, { latency: ["100", "500"] })).toBeNull();
    });
  });

  // ── Timerange fields ────────────────────────────────────────────────────────

  describe("timerange", () => {
    it("converts ISO strings to Date objects", () => {
      const result = parseAIResponse(schema, {
        date: ["2026-01-01T00:00:00Z", "2026-01-02T00:00:00Z"],
      });
      expect(result).not.toBeNull();
      const [start, end] = result!.date as [Date, Date];
      expect(start).toBeInstanceOf(Date);
      expect(end).toBeInstanceOf(Date);
      expect(start.toISOString()).toBe("2026-01-01T00:00:00.000Z");
      expect(end.toISOString()).toBe("2026-01-02T00:00:00.000Z");
    });

    it("rejects invalid date strings", () => {
      expect(
        parseAIResponse(schema, { date: ["not-a-date", "also-not"] }),
      ).toBeNull();
    });

    it("rejects when start > end", () => {
      expect(
        parseAIResponse(schema, {
          date: ["2026-01-02T00:00:00Z", "2026-01-01T00:00:00Z"],
        }),
      ).toBeNull();
    });

    it("rejects arrays with fewer than 2 elements", () => {
      expect(
        parseAIResponse(schema, { date: ["2026-01-01T00:00:00Z"] }),
      ).toBeNull();
    });
  });

  // ── Non-filterable / unknown fields ────────────────────────────────────────

  describe("unknown and non-filterable fields", () => {
    it("strips non-filterable fields", () => {
      const result = parseAIResponse(schema, {
        host: "example.com",
        message: "should be stripped",
      });
      expect(result).toEqual({ host: "example.com" });
    });

    it("strips unknown fields", () => {
      const result = parseAIResponse(schema, {
        host: "example.com",
        unknownField: "value",
      });
      expect(result).toEqual({ host: "example.com" });
    });
  });

  // ── Multiple fields ───────────────────────────────────────────────────────

  describe("multiple fields", () => {
    it("parses multiple valid fields", () => {
      const result = parseAIResponse(schema, {
        host: "example.com",
        level: ["error"],
        latency: [100, 500],
        regions: ["ams"],
      });
      expect(result).toEqual({
        host: "example.com",
        level: ["error"],
        latency: [100, 500],
        regions: ["ams"],
      });
    });

    it("returns only valid fields when some are invalid", () => {
      const result = parseAIResponse(schema, {
        host: "example.com",
        level: ["invalid"],
        latency: "not a tuple",
      });
      expect(result).toEqual({ host: "example.com" });
    });
  });
});

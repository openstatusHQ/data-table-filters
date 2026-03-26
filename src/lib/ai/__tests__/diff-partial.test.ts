import { describe, expect, it } from "vitest";
import { diffPartialState } from "../diff-partial";
import { testSchema } from "./test-schema";

const schema = testSchema.definition;

describe("diffPartialState", () => {
  // ── Input fields ──────────────────────────────────────────────────────────

  describe("input fields", () => {
    it("emits when a string field appears", () => {
      const result = diffPartialState({}, { host: "example.com" }, schema);
      expect(result).toEqual([{ key: "host", value: "example.com" }]);
    });

    it("emits when a string field changes", () => {
      const result = diffPartialState(
        { host: "old.com" },
        { host: "new.com" },
        schema,
      );
      expect(result).toEqual([{ key: "host", value: "new.com" }]);
    });

    it("does not emit when a string field is unchanged", () => {
      const result = diffPartialState(
        { host: "same.com" },
        { host: "same.com" },
        schema,
      );
      expect(result).toEqual([]);
    });

    it("emits when a number input field appears", () => {
      const result = diffPartialState({}, { status: 200 }, schema);
      expect(result).toEqual([{ key: "status", value: 200 }]);
    });

    it("does not emit for null/undefined values", () => {
      const result = diffPartialState({}, { host: null }, schema);
      expect(result).toEqual([]);
    });
  });

  // ── Checkbox fields ───────────────────────────────────────────────────────

  describe("checkbox fields", () => {
    it("emits when first value appears", () => {
      const result = diffPartialState({}, { level: ["info"] }, schema);
      expect(result).toEqual([{ key: "level", value: ["info"] }]);
    });

    it("emits when array grows", () => {
      const result = diffPartialState(
        { level: ["info"] },
        { level: ["info", "warn"] },
        schema,
      );
      expect(result).toEqual([{ key: "level", value: ["info", "warn"] }]);
    });

    it("does not emit for empty arrays", () => {
      const result = diffPartialState({}, { level: [] }, schema);
      expect(result).toEqual([]);
    });

    it("does not emit when array is unchanged", () => {
      const result = diffPartialState(
        { level: ["info", "warn"] },
        { level: ["info", "warn"] },
        schema,
      );
      expect(result).toEqual([]);
    });

    it("emits when array values change", () => {
      const result = diffPartialState(
        { level: ["info"] },
        { level: ["error"] },
        schema,
      );
      expect(result).toEqual([{ key: "level", value: ["error"] }]);
    });
  });

  // ── Slider fields ─────────────────────────────────────────────────────────

  describe("slider fields", () => {
    it("does not emit with only one value", () => {
      const result = diffPartialState({}, { latency: [100] }, schema);
      expect(result).toEqual([]);
    });

    it("emits when both values are present", () => {
      const result = diffPartialState({}, { latency: [100, 500] }, schema);
      expect(result).toEqual([{ key: "latency", value: [100, 500] }]);
    });

    it("emits when tuple values change", () => {
      const result = diffPartialState(
        { latency: [100, 500] },
        { latency: [200, 600] },
        schema,
      );
      expect(result).toEqual([{ key: "latency", value: [200, 600] }]);
    });

    it("does not emit when tuple is unchanged", () => {
      const result = diffPartialState(
        { latency: [100, 500] },
        { latency: [100, 500] },
        schema,
      );
      expect(result).toEqual([]);
    });

    it("does not emit for non-number values", () => {
      const result = diffPartialState({}, { latency: ["100", "500"] }, schema);
      expect(result).toEqual([]);
    });
  });

  // ── Timerange fields (commandDisabled but included for AI) ──────────────

  describe("timerange fields", () => {
    it("waits for both values in tuple", () => {
      const result = diffPartialState(
        {},
        { date: ["2026-01-01T00:00:00Z"] },
        schema,
      );
      expect(result).toEqual([]);
    });

    it("emits when both values are present", () => {
      const result = diffPartialState(
        {},
        { date: ["2026-01-01T00:00:00Z", "2026-01-02T00:00:00Z"] },
        schema,
      );
      expect(result).toEqual([
        {
          key: "date",
          value: ["2026-01-01T00:00:00Z", "2026-01-02T00:00:00Z"],
        },
      ]);
    });

    it("does not emit for non-string values", () => {
      const result = diffPartialState({}, { date: [123, 456] }, schema);
      expect(result).toEqual([]);
    });
  });

  // ── Non-filterable fields ─────────────────────────────────────────────────

  describe("non-filterable fields", () => {
    it("skips non-filterable fields", () => {
      const result = diffPartialState({}, { message: "hello" }, schema);
      expect(result).toEqual([]);
    });
  });

  // ── Multiple fields at once ───────────────────────────────────────────────

  describe("multiple fields", () => {
    it("returns multiple completed fields in one diff", () => {
      const result = diffPartialState(
        {},
        { host: "example.com", level: ["error"], latency: [100, 500] },
        schema,
      );
      expect(result).toHaveLength(3);
      expect(result.map((f) => f.key).sort()).toEqual([
        "host",
        "latency",
        "level",
      ]);
    });

    it("only returns changed fields", () => {
      const result = diffPartialState(
        { host: "example.com", level: ["error"] },
        { host: "example.com", level: ["error"], latency: [100, 500] },
        schema,
      );
      expect(result).toEqual([{ key: "latency", value: [100, 500] }]);
    });
  });
});

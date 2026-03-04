import { describe, expect, it } from "vitest";
import { col } from "./index";

// ── presets ──────────────────────────────────────────────────────────────────

describe("col.presets", () => {
  // -- logLevel --

  describe("logLevel", () => {
    const LEVELS = ["error", "warn", "info", "debug"] as const;
    const builder = col.presets.logLevel(LEVELS);

    it("has kind=enum", () => {
      expect(builder._config.kind).toBe("enum");
    });

    it("has label 'Level'", () => {
      expect(builder._config.label).toBe("Level");
    });

    it("has checkbox filter with options derived from values", () => {
      expect(builder._config.filter?.type).toBe("checkbox");
      if (builder._config.filter?.type === "checkbox") {
        expect(builder._config.filter.options).toEqual(
          LEVELS.map((v) => ({ label: v, value: v })),
        );
      }
    });

    it("has defaultOpen=true", () => {
      expect(builder._config.filter?.defaultOpen).toBe(true);
    });
  });

  // -- httpMethod --

  describe("httpMethod", () => {
    const METHODS = ["GET", "POST", "PUT", "DELETE"] as const;
    const builder = col.presets.httpMethod(METHODS);

    it("has kind=enum", () => {
      expect(builder._config.kind).toBe("enum");
    });

    it("has label 'Method'", () => {
      expect(builder._config.label).toBe("Method");
    });

    it("has display type 'text'", () => {
      expect(builder._config.display?.type).toBe("text");
    });

    it("has checkbox filter with options", () => {
      expect(builder._config.filter?.type).toBe("checkbox");
    });
  });

  // -- httpStatus --

  describe("httpStatus", () => {
    it("has kind=number", () => {
      const builder = col.presets.httpStatus();
      expect(builder._config.kind).toBe("number");
    });

    it("uses default status codes when none provided", () => {
      const builder = col.presets.httpStatus();
      expect(builder._config.filter?.type).toBe("checkbox");
      if (builder._config.filter?.type === "checkbox") {
        const values = builder._config.filter.options?.map((o) => o.value);
        expect(values).toContain(200);
        expect(values).toContain(404);
        expect(values).toContain(500);
        expect(values).toHaveLength(15); // default codes count
      }
    });

    it("uses custom codes when provided", () => {
      const builder = col.presets.httpStatus([200, 500]);
      if (builder._config.filter?.type === "checkbox") {
        expect(builder._config.filter.options).toEqual([
          { label: "200", value: 200 },
          { label: "500", value: 500 },
        ]);
      }
    });
  });

  // -- duration --

  describe("duration", () => {
    it("has kind=number with slider filter", () => {
      const builder = col.presets.duration("ms");
      expect(builder._config.kind).toBe("number");
      expect(builder._config.filter?.type).toBe("slider");
    });

    it("defaults to slider bounds { min: 0, max: 5000 }", () => {
      const builder = col.presets.duration();
      if (builder._config.filter?.type === "slider") {
        expect(builder._config.filter.min).toBe(0);
        expect(builder._config.filter.max).toBe(5000);
      }
    });

    it("accepts custom slider bounds", () => {
      const builder = col.presets.duration("s", { min: 0, max: 60 });
      if (builder._config.filter?.type === "slider") {
        expect(builder._config.filter.min).toBe(0);
        expect(builder._config.filter.max).toBe(60);
      }
    });

    it("has number display with unit", () => {
      const builder = col.presets.duration("ms");
      expect(builder._config.display?.type).toBe("number");
    });
  });

  // -- timestamp --

  describe("timestamp", () => {
    const builder = col.presets.timestamp();

    it("has kind=timestamp", () => {
      expect(builder._config.kind).toBe("timestamp");
    });

    it("has timerange filter", () => {
      expect(builder._config.filter?.type).toBe("timerange");
    });

    it("is sortable", () => {
      expect(builder._config.sortable).toBe(true);
    });

    it("has timestamp display", () => {
      expect(builder._config.display?.type).toBe("timestamp");
    });
  });

  // -- traceId --

  describe("traceId", () => {
    const builder = col.presets.traceId();

    it("has kind=string", () => {
      expect(builder._config.kind).toBe("string");
    });

    it("has code display", () => {
      expect(builder._config.display?.type).toBe("code");
    });

    it("is not filterable", () => {
      expect(builder._config.filter).toBeNull();
    });
  });

  // -- pathname --

  describe("pathname", () => {
    const builder = col.presets.pathname();

    it("has kind=string", () => {
      expect(builder._config.kind).toBe("string");
    });

    it("has input filter", () => {
      expect(builder._config.filter?.type).toBe("input");
    });

    it("has label 'Pathname'", () => {
      expect(builder._config.label).toBe("Pathname");
    });
  });

  // -- chainability --

  it("presets are chainable (can override defaults)", () => {
    const builder = col.presets.logLevel(["error", "warn"] as const)
      .label("Severity")
      .size(100);
    expect(builder._config.label).toBe("Severity");
    expect(builder._config.size).toBe(100);
  });
});

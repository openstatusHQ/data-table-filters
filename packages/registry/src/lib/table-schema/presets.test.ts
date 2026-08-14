import { describe, expect, it } from "vitest";
import { resolveColumn } from "./col";
import { col } from "./index";

// ── presets ──────────────────────────────────────────────────────────────────

describe("col.presets", () => {
  // -- logLevel --

  describe("logLevel", () => {
    const LEVELS = ["error", "warn", "info", "debug"] as const;
    const c = resolveColumn(col.presets.logLevel(LEVELS));

    it("has kind=enum", () => {
      expect(c.kind).toBe("enum");
    });

    it("has label 'Level'", () => {
      expect(c.label).toBe("Level");
    });

    it("has checkbox filter with options derived from values", () => {
      expect(c.filter?.type).toBe("checkbox");
      expect(c.filter?.options).toEqual(
        LEVELS.map((v) => ({ label: v, value: v })),
      );
    });

    it("has defaultOpen=true", () => {
      expect(c.filter?.defaultOpen).toBe(true);
    });

    it("records preset provenance with the values it was given", () => {
      expect(c.provenance).toEqual({
        source: "preset",
        preset: "logLevel",
        args: [LEVELS],
      });
    });
  });

  // -- httpMethod --

  describe("httpMethod", () => {
    const METHODS = ["GET", "POST", "PUT", "DELETE"] as const;
    const c = resolveColumn(col.presets.httpMethod(METHODS));

    it("has kind=enum", () => {
      expect(c.kind).toBe("enum");
    });

    it("has label 'Method'", () => {
      expect(c.label).toBe("Method");
    });

    it("has display type 'text'", () => {
      expect(c.display.type).toBe("text");
    });

    it("has checkbox filter with options", () => {
      expect(c.filter?.type).toBe("checkbox");
      expect(c.filter?.options).toEqual(
        METHODS.map((v) => ({ label: v, value: v })),
      );
    });

    it("records preset provenance", () => {
      expect(c.provenance).toEqual({
        source: "preset",
        preset: "httpMethod",
        args: [METHODS],
      });
    });
  });

  // -- httpStatus --

  describe("httpStatus", () => {
    it("has kind=number", () => {
      expect(resolveColumn(col.presets.httpStatus()).kind).toBe("number");
    });

    it("uses default status codes when none provided", () => {
      const c = resolveColumn(col.presets.httpStatus());
      expect(c.filter?.type).toBe("checkbox");
      const values = c.filter?.options?.map((o) => o.value);
      expect(values).toContain(200);
      expect(values).toContain(404);
      expect(values).toContain(500);
      expect(values).toHaveLength(15); // default codes count
    });

    it("uses custom codes when provided", () => {
      const c = resolveColumn(col.presets.httpStatus([200, 500]));
      expect(c.filter?.options).toEqual([
        { label: "200", value: 200 },
        { label: "500", value: 500 },
      ]);
    });

    it("records provenance with no args when codes are omitted", () => {
      expect(resolveColumn(col.presets.httpStatus()).provenance).toEqual({
        source: "preset",
        preset: "httpStatus",
        args: [],
      });
    });

    it("records provenance with the custom codes", () => {
      expect(
        resolveColumn(col.presets.httpStatus([200, 500])).provenance,
      ).toEqual({ source: "preset", preset: "httpStatus", args: [[200, 500]] });
    });
  });

  // -- duration --

  describe("duration", () => {
    it("has kind=number with slider filter", () => {
      const c = resolveColumn(col.presets.duration("ms"));
      expect(c.kind).toBe("number");
      expect(c.filter?.type).toBe("slider");
    });

    it("defaults to slider bounds { min: 0, max: 5000 }", () => {
      const c = resolveColumn(col.presets.duration());
      expect(c.filter?.min).toBe(0);
      expect(c.filter?.max).toBe(5000);
    });

    it("accepts custom slider bounds", () => {
      const c = resolveColumn(col.presets.duration("s", { min: 0, max: 60 }));
      expect(c.filter?.min).toBe(0);
      expect(c.filter?.max).toBe(60);
    });

    it("has number display with unit", () => {
      const c = resolveColumn(col.presets.duration("ms"));
      expect(c.display).toEqual({ type: "number", unit: "ms" });
    });

    it("trims the trailing omitted arg from provenance", () => {
      expect(resolveColumn(col.presets.duration("ms")).provenance).toEqual({
        source: "preset",
        preset: "duration",
        args: ["ms"],
      });
    });

    it("stores an omitted middle arg as null in provenance", () => {
      const c = resolveColumn(
        col.presets.duration(undefined, { min: 0, max: 60 }),
      );
      expect(c.provenance).toEqual({
        source: "preset",
        preset: "duration",
        args: [null, { min: 0, max: 60 }],
      });
    });

    it("records empty args when both are omitted", () => {
      expect(resolveColumn(col.presets.duration()).provenance).toEqual({
        source: "preset",
        preset: "duration",
        args: [],
      });
    });
  });

  // -- timestamp --

  describe("timestamp", () => {
    const c = resolveColumn(col.presets.timestamp());

    it("has kind=timestamp", () => {
      expect(c.kind).toBe("timestamp");
    });

    it("has timerange filter", () => {
      expect(c.filter?.type).toBe("timerange");
    });

    it("is sortable", () => {
      expect(c.sortable).toBe(true);
    });

    it("has timestamp display", () => {
      expect(c.display.type).toBe("timestamp");
    });

    it("records preset provenance with no args", () => {
      expect(c.provenance).toEqual({
        source: "preset",
        preset: "timestamp",
        args: [],
      });
    });
  });

  // -- traceId --

  describe("traceId", () => {
    const c = resolveColumn(col.presets.traceId());

    it("has kind=string", () => {
      expect(c.kind).toBe("string");
    });

    it("has code display", () => {
      expect(c.display.type).toBe("code");
    });

    it("is not filterable", () => {
      expect(c.filter).toBeNull();
    });

    it("records preset provenance with no args", () => {
      expect(c.provenance).toEqual({
        source: "preset",
        preset: "traceId",
        args: [],
      });
    });
  });

  // -- pathname --

  describe("pathname", () => {
    const c = resolveColumn(col.presets.pathname());

    it("has kind=string", () => {
      expect(c.kind).toBe("string");
    });

    it("has input filter", () => {
      expect(c.filter?.type).toBe("input");
    });

    it("has label 'Pathname'", () => {
      expect(c.label).toBe("Pathname");
    });

    it("records preset provenance with no args", () => {
      expect(c.provenance).toEqual({
        source: "preset",
        preset: "pathname",
        args: [],
      });
    });
  });

  // -- latency --

  describe("latency", () => {
    it("has a heatmap display over the slider bounds and is sortable", () => {
      const c = resolveColumn(col.presets.latency("ms"));
      expect(c.display).toEqual({
        type: "heatmap",
        unit: "ms",
        min: 0,
        max: 5000,
      });
      expect(c.filter?.type).toBe("slider");
      expect(c.sortable).toBe(true);
    });

    it("records preset provenance, trimming the omitted slider arg", () => {
      expect(resolveColumn(col.presets.latency("ms")).provenance).toEqual({
        source: "preset",
        preset: "latency",
        args: ["ms"],
      });
    });

    it("records both args when custom bounds are given", () => {
      const c = resolveColumn(col.presets.latency("s", { min: 0, max: 60 }));
      expect(c.provenance).toEqual({
        source: "preset",
        preset: "latency",
        args: ["s", { min: 0, max: 60 }],
      });
    });
  });

  // -- health --

  describe("health", () => {
    it("has a gauge display over 0–100 and is sortable", () => {
      const c = resolveColumn(col.presets.health());
      expect(c.display).toEqual({ type: "gauge", min: 0, max: 100 });
      expect(c.sortable).toBe(true);
    });

    it("records preset provenance with no args by default", () => {
      expect(resolveColumn(col.presets.health()).provenance).toEqual({
        source: "preset",
        preset: "health",
        args: [],
      });
    });

    it("records the custom range in provenance", () => {
      const c = resolveColumn(col.presets.health({ min: 0, max: 1000 }));
      expect(c.provenance).toEqual({
        source: "preset",
        preset: "health",
        args: [{ min: 0, max: 1000 }],
      });
    });
  });

  // -- progress --

  describe("progress", () => {
    it("has a bar display over 0–100 and is sortable", () => {
      const c = resolveColumn(col.presets.progress());
      expect(c.display).toEqual({ type: "bar", min: 0, max: 100 });
      expect(c.sortable).toBe(true);
    });

    it("records preset provenance", () => {
      const c = resolveColumn(col.presets.progress({ min: 0, max: 1000 }));
      expect(c.provenance).toEqual({
        source: "preset",
        preset: "progress",
        args: [{ min: 0, max: 1000 }],
      });
    });
  });

  // -- chainability --

  it("presets are chainable (can override defaults)", () => {
    const c = resolveColumn(
      col.presets
        .logLevel(["error", "warn"] as const)
        .label("Severity")
        .size(100),
    );
    expect(c.label).toBe("Severity");
    expect(c.size).toBe(100);
  });

  it("chaining after a preset keeps the preset provenance", () => {
    const c = resolveColumn(
      col.presets.duration("ms").label("Latency").sortable().sheet(),
    );
    expect(c.provenance).toEqual({
      source: "preset",
      preset: "duration",
      args: ["ms"],
    });
  });
});

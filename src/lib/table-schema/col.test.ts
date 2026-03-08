import { describe, expect, it } from "vitest";
import { col } from "./col";

// ── col.string() ──────────────────────────────────────────────────────────────

describe("col.string()", () => {
  it("has kind 'string' with default filter type 'input'", () => {
    const c = col.string();
    expect(c._config.kind).toBe("string");
    expect(c._config.filter?.type).toBe("input");
  });

  it("has default display type 'text'", () => {
    expect(col.string()._config.display).toEqual({ type: "text" });
  });

  it("starts with empty label, hidden: false, sortable: false, optional: false", () => {
    const cfg = col.string()._config;
    expect(cfg.label).toBe("");
    expect(cfg.hidden).toBe(false);
    expect(cfg.sortable).toBe(false);
    expect(cfg.optional).toBe(false);
    expect(cfg.sheet).toBeNull();
  });

  it(".label() sets the column label", () => {
    expect(col.string().label("Host")._config.label).toBe("Host");
  });

  it(".description() sets the description", () => {
    const c = col.string().label("Host").description("The origin host");
    expect(c._config.description).toBe("The origin host");
  });

  it(".hidden() sets hidden to true", () => {
    expect(col.string().label("Host").hidden()._config.hidden).toBe(true);
  });

  it(".sortable() sets sortable to true", () => {
    expect(col.string().label("Host").sortable()._config.sortable).toBe(true);
  });

  it(".optional() sets optional to true", () => {
    expect(col.string().label("Host").optional()._config.optional).toBe(true);
  });

  it(".size() sets the pixel size", () => {
    expect(col.string().label("Host").size(200)._config.size).toBe(200);
  });

  it(".notFilterable() sets filter to null", () => {
    expect(
      col.string().label("Host").notFilterable()._config.filter,
    ).toBeNull();
  });

  it(".defaultOpen() sets filter.defaultOpen to true", () => {
    expect(
      col.string().label("Host").defaultOpen()._config.filter?.defaultOpen,
    ).toBe(true);
  });

  it(".commandDisabled() sets filter.commandDisabled to true", () => {
    expect(
      col.string().label("Host").commandDisabled()._config.filter
        ?.commandDisabled,
    ).toBe(true);
  });

  it(".sheet() with no args sets sheet to {}", () => {
    expect(col.string().label("Host").sheet()._config.sheet).toEqual({});
  });

  it(".sheet(config) stores the provided sheet config", () => {
    const c = col.string().label("Host").sheet({ className: "flex-col" });
    expect(c._config.sheet).toEqual({ className: "flex-col" });
  });

  it(".display() overrides the display config", () => {
    const c = col.string().label("Host").display("code");
    expect(c._config.display).toEqual({ type: "code" });
  });

  it(".display() with colorMap stores the colorMap", () => {
    const colorMap = { active: "#22c55e", inactive: "#6b7280" };
    const c = col.string().label("Status").display("badge", { colorMap });
    expect(c._config.display).toEqual({ type: "badge", colorMap });
  });

  it("is immutable — each method returns a new builder instance", () => {
    const base = col.string();
    const withLabel = base.label("Host");
    expect(base._config.label).toBe("");
    expect(withLabel._config.label).toBe("Host");
  });

  it("method chaining preserves all accumulated config", () => {
    const c = col
      .string()
      .label("Host")
      .description("Origin host")
      .hidden()
      .sortable()
      .size(120)
      .commandDisabled()
      .sheet();
    expect(c._config.label).toBe("Host");
    expect(c._config.description).toBe("Origin host");
    expect(c._config.hidden).toBe(true);
    expect(c._config.sortable).toBe(true);
    expect(c._config.size).toBe(120);
    expect(c._config.filter?.commandDisabled).toBe(true);
    expect(c._config.sheet).toEqual({});
  });

  it('.display("status-code") sets display config', () => {
    const c = col.string().label("Status").display("status-code");
    expect(c._config.display).toEqual({ type: "status-code" });
  });

  it('.display("level-indicator") sets display config', () => {
    const c = col.string().label("Level").display("level-indicator");
    expect(c._config.display).toEqual({ type: "level-indicator" });
  });
});

// ── col.number() ──────────────────────────────────────────────────────────────

describe("col.number()", () => {
  it("has kind 'number' with default filter type 'input'", () => {
    const c = col.number();
    expect(c._config.kind).toBe("number");
    expect(c._config.filter?.type).toBe("input");
  });

  it("has default display type 'number'", () => {
    expect(col.number()._config.display).toEqual({ type: "number" });
  });

  it(".filterable('slider', ...) sets type and bounds", () => {
    const c = col
      .number()
      .label("Latency")
      .filterable("slider", { min: 0, max: 5000 });
    expect(c._config.filter?.type).toBe("slider");
    expect((c._config.filter as any).min).toBe(0);
    expect((c._config.filter as any).max).toBe(5000);
  });

  it(".filterable('checkbox', ...) sets type and options", () => {
    const options = [{ label: "200", value: 200 }];
    const c = col.number().label("Status").filterable("checkbox", { options });
    expect(c._config.filter?.type).toBe("checkbox");
    expect((c._config.filter as any).options).toEqual(options);
  });

  it(".display('number', { unit }) stores the unit", () => {
    const c = col.number().label("Latency").display("number", { unit: "ms" });
    expect(c._config.display).toEqual({ type: "number", unit: "ms" });
  });

  it(".display('number', { unit, colorMap }) stores both", () => {
    const colorMap = { "200": "#22c55e", "500": "#ef4444" };
    const c = col
      .number()
      .label("Status")
      .display("number", { unit: "ms", colorMap });
    expect(c._config.display).toEqual({ type: "number", unit: "ms", colorMap });
  });
});

// ── col.boolean() ─────────────────────────────────────────────────────────────

describe("col.boolean()", () => {
  it("has kind 'boolean' with default filter type 'checkbox'", () => {
    const c = col.boolean();
    expect(c._config.kind).toBe("boolean");
    expect(c._config.filter?.type).toBe("checkbox");
  });

  it("has default display type 'boolean'", () => {
    expect(col.boolean()._config.display).toEqual({ type: "boolean" });
  });

  it("pre-wires true/false checkbox options", () => {
    const c = col.boolean();
    expect((c._config.filter as any).options).toEqual([
      { label: "true", value: true },
      { label: "false", value: false },
    ]);
  });
});

// ── col.timestamp() ───────────────────────────────────────────────────────────

describe("col.timestamp()", () => {
  it("has kind 'timestamp' with default filter type 'timerange'", () => {
    const c = col.timestamp();
    expect(c._config.kind).toBe("timestamp");
    expect(c._config.filter?.type).toBe("timerange");
  });

  it("has default display type 'timestamp'", () => {
    expect(col.timestamp()._config.display).toEqual({ type: "timestamp" });
  });
});

// ── col.enum() ────────────────────────────────────────────────────────────────

describe("col.enum()", () => {
  const LEVELS = ["error", "warn", "info"] as const;

  it("has kind 'enum' with default filter type 'checkbox'", () => {
    const c = col.enum(LEVELS);
    expect(c._config.kind).toBe("enum");
    expect(c._config.filter?.type).toBe("checkbox");
  });

  it("has default display type 'badge'", () => {
    expect(col.enum(LEVELS)._config.display).toEqual({ type: "badge" });
  });

  it("stores the raw enum values on the config", () => {
    expect((col.enum(LEVELS)._config as any).enumValues).toEqual(LEVELS);
  });

  it("auto-derives checkbox options from the provided values", () => {
    const c = col.enum(LEVELS);
    expect((c._config.filter as any).options).toEqual([
      { label: "error", value: "error" },
      { label: "warn", value: "warn" },
      { label: "info", value: "info" },
    ]);
  });

  it(".filterable('checkbox', { options }) overrides the auto-derived options", () => {
    const custom = [{ label: "Error", value: "error" }];
    const c = col
      .enum(LEVELS)
      .label("Level")
      .filterable("checkbox", { options: custom });
    expect((c._config.filter as any).options).toEqual(custom);
  });
});

// ── col.array() ───────────────────────────────────────────────────────────────

describe("col.array()", () => {
  const REGIONS = ["us-east", "eu-west"] as const;

  it("has kind 'array' with default filter type 'checkbox'", () => {
    const c = col.array(col.enum(REGIONS));
    expect(c._config.kind).toBe("array");
    expect(c._config.filter?.type).toBe("checkbox");
  });

  it("has default display type 'badge'", () => {
    expect(col.array(col.enum(REGIONS))._config.display).toEqual({
      type: "badge",
    });
  });

  it("stores the item builder's config as arrayItem", () => {
    const item = col.enum(REGIONS);
    const c = col.array(item);
    expect((c._config as any).arrayItem).toEqual(item._config);
  });
});

// ── col.record() ──────────────────────────────────────────────────────────────

describe("col.record()", () => {
  it("has kind 'record' and filter is null", () => {
    const c = col.record();
    expect(c._config.kind).toBe("record");
    expect(c._config.filter).toBeNull();
  });

  it("has default display type 'text'", () => {
    expect(col.record()._config.display).toEqual({ type: "text" });
  });
});

// ── .filterable() option preservation ────────────────────────────────────────

describe(".filterable() option preservation", () => {
  it("preserves existing options when called again with the same type and no new options", () => {
    const options = [{ label: "Error", value: "error" }];
    const c = col
      .string()
      .label("Level")
      // @ts-expect-error - we're testing option preservation
      .filterable("input", { options })
      .filterable("input"); // no options — should preserve
    expect((c._config.filter as any).options).toEqual(options);
  });

  it("drops options when switching to a different filter type", () => {
    const options = [{ label: "Error", value: "error" }];
    const c = col
      .number()
      .label("Count")
      .filterable("checkbox", { options })
      // @ts-expect-error - testing filter type switch (F narrowed to "checkbox")
      .filterable("input"); // type change — options not preserved
    expect((c._config.filter as any).options).toBeUndefined();
  });
});

// ── no-op guards ──────────────────────────────────────────────────────────────

describe(".defaultOpen() and .commandDisabled() on notFilterable column", () => {
  it(".defaultOpen() is a no-op when filter is null", () => {
    const c = col.string().label("Host").notFilterable().defaultOpen();
    expect(c._config.filter).toBeNull();
  });

  it(".commandDisabled() is a no-op when filter is null", () => {
    const c = col.string().label("Host").notFilterable().commandDisabled();
    expect(c._config.filter).toBeNull();
  });
});

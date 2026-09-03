import type { DatePreset } from "@dtf/registry/components/data-table/types";
import { describe, expect, it } from "vitest";
import { col, resolveColumn } from "./col";

// Stand-in renderers. The test file is `.ts`, so the closures return `null`
// rather than JSX — identity is all these assertions care about.
const cell = () => null;
const filterComponent = () => null;
const sheetComponent = () => null;
const sheetCondition = () => true;

// ── col.string() ──────────────────────────────────────────────────────────────

describe("col.string()", () => {
  it("has kind 'string' with default filter type 'input'", () => {
    const c = resolveColumn(col.string());
    expect(c.kind).toBe("string");
    expect(c.filter?.type).toBe("input");
  });

  it("has default display type 'text'", () => {
    expect(resolveColumn(col.string()).display).toEqual({ type: "text" });
  });

  it("starts with empty label, hidden: false, sortable: false, optional: false", () => {
    const c = resolveColumn(col.string());
    expect(c.label).toBe("");
    expect(c.hidden).toBe(false);
    expect(c.sortable).toBe(false);
    expect(c.optional).toBe(false);
    expect(c.sheet).toBeNull();
  });

  it("is manual provenance and carries no renderers", () => {
    const c = resolveColumn(col.string());
    expect(c.provenance).toEqual({ source: "manual" });
    expect(c.renderers).toEqual({});
  });

  it(".label() sets the column label", () => {
    expect(resolveColumn(col.string().label("Host")).label).toBe("Host");
  });

  it(".description() sets the description", () => {
    const c = resolveColumn(
      col.string().label("Host").description("The origin host"),
    );
    expect(c.description).toBe("The origin host");
  });

  it(".hidden() sets hidden to true", () => {
    expect(resolveColumn(col.string().label("Host").hidden()).hidden).toBe(
      true,
    );
  });

  it(".sortable() sets sortable to true", () => {
    expect(resolveColumn(col.string().label("Host").sortable()).sortable).toBe(
      true,
    );
  });

  it(".resizable() sets resizable to true", () => {
    expect(
      resolveColumn(col.string().label("Host").resizable()).resizable,
    ).toBe(true);
  });

  it(".hideHeader() sets hideHeader to true", () => {
    expect(
      resolveColumn(col.string().label("Host").hideHeader()).hideHeader,
    ).toBe(true);
  });

  it(".optional() sets optional to true", () => {
    expect(resolveColumn(col.string().label("Host").optional()).optional).toBe(
      true,
    );
  });

  it(".minSize() sets the pixel floor", () => {
    expect(
      resolveColumn(col.timestamp().label("Date").minSize(200)).minSize,
    ).toBe(200);
  });

  it(".size() sets the pixel size", () => {
    expect(resolveColumn(col.string().label("Host").size(200)).size).toBe(200);
  });

  it(".notFilterable() sets filter to null", () => {
    expect(
      resolveColumn(col.string().label("Host").notFilterable()).filter,
    ).toBeNull();
  });

  it(".defaultOpen() sets filter.defaultOpen to true", () => {
    expect(
      resolveColumn(col.string().label("Host").defaultOpen()).filter
        ?.defaultOpen,
    ).toBe(true);
  });

  it(".commandDisabled() sets filter.commandDisabled to true", () => {
    expect(
      resolveColumn(col.string().label("Host").commandDisabled()).filter
        ?.commandDisabled,
    ).toBe(true);
  });

  it(".sheet() with no args sets sheet to {}", () => {
    expect(resolveColumn(col.string().label("Host").sheet()).sheet).toEqual({});
  });

  it(".sheet(config) stores the provided sheet config", () => {
    const c = resolveColumn(
      col.string().label("Host").sheet({ className: "flex-col" }),
    );
    expect(c.sheet).toEqual({ className: "flex-col" });
  });

  it(".display() overrides the display config", () => {
    expect(
      resolveColumn(col.string().label("Host").display("code")).display,
    ).toEqual({ type: "code" });
  });

  it(".display() with colorMap stores the colorMap", () => {
    const colorMap = { active: "#22c55e", inactive: "#6b7280" };
    const c = resolveColumn(
      col.string().label("Status").display("badge", { colorMap }),
    );
    expect(c.display).toEqual({ type: "badge", colorMap });
  });

  it("method chaining preserves all accumulated config", () => {
    const c = resolveColumn(
      col
        .string()
        .label("Host")
        .description("Origin host")
        .hidden()
        .sortable()
        .size(120)
        .commandDisabled()
        .sheet(),
    );
    expect(c.label).toBe("Host");
    expect(c.description).toBe("Origin host");
    expect(c.hidden).toBe(true);
    expect(c.sortable).toBe(true);
    expect(c.size).toBe(120);
    expect(c.filter?.commandDisabled).toBe(true);
    expect(c.sheet).toEqual({});
  });

  it('.display("status-code") sets display config', () => {
    const c = resolveColumn(
      col.string().label("Status").display("status-code"),
    );
    expect(c.display).toEqual({ type: "status-code" });
  });

  it('.display("level-indicator") sets display config', () => {
    const c = resolveColumn(
      col.string().label("Level").display("level-indicator"),
    );
    expect(c.display).toEqual({ type: "level-indicator" });
  });
});

// ── col.number() ──────────────────────────────────────────────────────────────

describe("col.number()", () => {
  it("has kind 'number' with default filter type 'input'", () => {
    const c = resolveColumn(col.number());
    expect(c.kind).toBe("number");
    expect(c.filter?.type).toBe("input");
  });

  it("has default display type 'number'", () => {
    expect(resolveColumn(col.number()).display).toEqual({ type: "number" });
  });

  it(".filterable('slider', ...) sets type and bounds", () => {
    const c = resolveColumn(
      col.number().label("Latency").filterable("slider", { min: 0, max: 5000 }),
    );
    expect(c.filter).toEqual({
      type: "slider",
      defaultOpen: false,
      commandDisabled: false,
      min: 0,
      max: 5000,
    });
  });

  it(".filterable('slider', { unit }) keeps the unit on the filter", () => {
    const c = resolveColumn(
      col
        .number()
        .label("Latency")
        .filterable("slider", { min: 0, max: 5000, unit: "ms" }),
    );
    expect(c.filter?.unit).toBe("ms");
  });

  it(".filterable('checkbox', ...) sets type and options", () => {
    const c = resolveColumn(
      col
        .number()
        .label("Status")
        .filterable("checkbox", { options: [{ label: "200", value: 200 }] }),
    );
    expect(c.filter?.type).toBe("checkbox");
    expect(c.filter?.options).toEqual([{ label: "200", value: 200 }]);
  });

  it(".filterable('checkbox', ...) strips options down to label/value", () => {
    // A caller-supplied option may carry extra fields (icons, counts). Only the
    // two serializable ones reach the descriptor.
    const wide = { label: "200", value: 200, icon: () => null };
    const c = resolveColumn(
      col
        .number()
        .label("Status")
        .filterable("checkbox", { options: [wide] }),
    );
    expect(c.filter?.options?.[0]).toEqual({ label: "200", value: 200 });
    expect(Object.keys(c.filter?.options?.[0] ?? {})).toEqual([
      "label",
      "value",
    ]);
  });

  it(".display('number', { unit }) stores the unit", () => {
    const c = resolveColumn(
      col.number().label("Latency").display("number", { unit: "ms" }),
    );
    expect(c.display).toEqual({ type: "number", unit: "ms" });
  });

  it(".display('number', { unit, colorMap }) stores both", () => {
    const colorMap = { "200": "#22c55e", "500": "#ef4444" };
    const c = resolveColumn(
      col.number().label("Status").display("number", { unit: "ms", colorMap }),
    );
    expect(c.display).toEqual({ type: "number", unit: "ms", colorMap });
  });
});

// ── col.boolean() ─────────────────────────────────────────────────────────────

describe("col.boolean()", () => {
  it("has kind 'boolean' with default filter type 'checkbox'", () => {
    const c = resolveColumn(col.boolean());
    expect(c.kind).toBe("boolean");
    expect(c.filter?.type).toBe("checkbox");
  });

  it("has default display type 'boolean'", () => {
    expect(resolveColumn(col.boolean()).display).toEqual({ type: "boolean" });
  });

  it("pre-wires true/false checkbox options", () => {
    expect(resolveColumn(col.boolean()).filter?.options).toEqual([
      { label: "true", value: true },
      { label: "false", value: false },
    ]);
  });
});

// ── col.timestamp() ───────────────────────────────────────────────────────────

describe("col.timestamp()", () => {
  it("has kind 'timestamp' with default filter type 'timerange'", () => {
    const c = resolveColumn(col.timestamp());
    expect(c.kind).toBe("timestamp");
    expect(c.filter?.type).toBe("timerange");
  });

  it("has default display type 'timestamp'", () => {
    expect(resolveColumn(col.timestamp()).display).toEqual({
      type: "timestamp",
    });
  });

  it(".filterable('timerange', { presets }) stores presets as ISO instants", () => {
    const presets: DatePreset[] = [
      {
        label: "Last hour",
        shortcut: "h",
        from: new Date("2024-01-01T11:00:00.000Z"),
        to: new Date("2024-01-01T12:00:00.000Z"),
      },
    ];
    const c = resolveColumn(
      col.timestamp().label("Date").filterable("timerange", { presets }),
    );
    expect(c.filter?.presets).toEqual([
      {
        label: "Last hour",
        shortcut: "h",
        from: "2024-01-01T11:00:00.000Z",
        to: "2024-01-01T12:00:00.000Z",
      },
    ]);
  });

  it("preserves presets when .filterable('timerange') is called again bare", () => {
    const presets: DatePreset[] = [
      {
        label: "Last hour",
        shortcut: "h",
        from: new Date("2024-01-01T11:00:00.000Z"),
        to: new Date("2024-01-01T12:00:00.000Z"),
      },
    ];
    const c = resolveColumn(
      col
        .timestamp()
        .label("Date")
        .filterable("timerange", { presets })
        .filterable("timerange"),
    );
    expect(c.filter?.presets).toHaveLength(1);
  });
});

// ── col.enum() ────────────────────────────────────────────────────────────────

describe("col.enum()", () => {
  const LEVELS = ["error", "warn", "info"] as const;

  it("has kind 'enum' with default filter type 'checkbox'", () => {
    const c = resolveColumn(col.enum(LEVELS));
    expect(c.kind).toBe("enum");
    expect(c.filter?.type).toBe("checkbox");
  });

  it("has default display type 'badge'", () => {
    expect(resolveColumn(col.enum(LEVELS)).display).toEqual({ type: "badge" });
  });

  it("stores the raw enum values on the descriptor", () => {
    const c = resolveColumn(col.enum(LEVELS));
    expect(c.kind === "enum" && c.enumValues).toEqual(LEVELS);
  });

  it("auto-derives checkbox options from the provided values", () => {
    expect(resolveColumn(col.enum(LEVELS)).filter?.options).toEqual([
      { label: "error", value: "error" },
      { label: "warn", value: "warn" },
      { label: "info", value: "info" },
    ]);
  });

  it(".filterable('checkbox', { options }) overrides the auto-derived options", () => {
    const custom = [{ label: "Error", value: "error" }];
    const c = resolveColumn(
      col.enum(LEVELS).label("Level").filterable("checkbox", {
        options: custom,
      }),
    );
    expect(c.filter?.options).toEqual(custom);
  });
});

// ── col.array() ───────────────────────────────────────────────────────────────

describe("col.array()", () => {
  const REGIONS = ["us-east", "eu-west"] as const;

  it("has kind 'array' with default filter type 'checkbox'", () => {
    const c = resolveColumn(col.array(col.enum(REGIONS)));
    expect(c.kind).toBe("array");
    expect(c.filter?.type).toBe("checkbox");
  });

  it("has default display type 'badge'", () => {
    expect(resolveColumn(col.array(col.enum(REGIONS))).display).toEqual({
      type: "badge",
    });
  });

  it("records the item descriptor as arrayItem", () => {
    const item = col.enum(REGIONS);
    const c = resolveColumn(col.array(item));
    if (c.kind !== "array") throw new Error("expected an array column");
    expect(c.arrayItem.kind).toBe("enum");
    expect(c.arrayItem.kind === "enum" && c.arrayItem.enumValues).toEqual(
      REGIONS,
    );
  });

  it("records arrayItem.kind 'string' for col.array(col.string())", () => {
    const c = resolveColumn(col.array(col.string()));
    if (c.kind !== "array") throw new Error("expected an array column");
    expect(c.arrayItem.kind).toBe("string");
    expect(c.arrayItem.display).toEqual({ type: "text" });
  });
});

// ── col.record() ──────────────────────────────────────────────────────────────

describe("col.record()", () => {
  it("has kind 'record' and filter is null", () => {
    const c = resolveColumn(col.record());
    expect(c.kind).toBe("record");
    expect(c.filter).toBeNull();
  });

  it("has default display type 'text'", () => {
    expect(resolveColumn(col.record()).display).toEqual({ type: "text" });
  });
});

// ── col.select() ──────────────────────────────────────────────────────────────

describe("col.select()", () => {
  it("has kind 'select' with filter null (not filterable)", () => {
    const c = resolveColumn(col.select());
    expect(c.kind).toBe("select");
    expect(c.filter).toBeNull();
  });

  it("has default label 'Select'", () => {
    expect(resolveColumn(col.select()).label).toBe("Select");
  });

  it("has sheet null (not shown in detail panel)", () => {
    expect(resolveColumn(col.select()).sheet).toBeNull();
  });

  it("is not sortable, not resizable, not hideable", () => {
    const c = resolveColumn(col.select());
    expect(c.sortable).toBe(false);
    expect(c.resizable).toBe(false);
    expect(c.enableHiding).toBe(false);
  });

  it("has default size of 40", () => {
    expect(resolveColumn(col.select()).size).toBe(40);
  });

  it(".size() overrides the default size", () => {
    expect(resolveColumn(col.select().size(37)).size).toBe(37);
  });
});

// ── the descriptor / renderers split ──────────────────────────────────────────

describe("descriptor / renderers split", () => {
  it('.display("custom", { cell }) leaves the descriptor display at the kind default', () => {
    const c = resolveColumn(
      col.enum(["a", "b"] as const).display("custom", {
        cell,
      }),
    );
    // "custom" is not a descriptor state — the enum default survives, so the
    // serialized column and its sheet field agree on `badge`.
    expect(c.display).toEqual({ type: "badge" });
    expect(c.renderers.cell).toBe(cell);
  });

  it('.display("custom") keeps whatever display an earlier .display() set', () => {
    const c = resolveColumn(
      col.number().display("bar", { min: 0, max: 100 }).display("custom", {
        cell,
      }),
    );
    expect(c.display).toEqual({ type: "bar", min: 0, max: 100 });
    expect(c.renderers.cell).toBe(cell);
  });

  it('.display("custom", { cell, colorMap }) merges colorMap into the descriptor display', () => {
    const colorMap = { error: "#ef4444" };
    const c = resolveColumn(
      col
        .enum(["error", "warn"] as const)
        .display("custom", { cell, colorMap }),
    );
    expect(c.display).toEqual({ type: "badge", colorMap });
    expect(c.renderers.cell).toBe(cell);
  });

  it('.filterable("checkbox", { component }) puts component in renderers only', () => {
    const c = resolveColumn(
      col
        .enum(["a", "b"] as const)
        .label("Kind")
        .filterable("checkbox", { component: filterComponent }),
    );
    expect(c.renderers.filterComponent).toBe(filterComponent);
    expect(c.filter).not.toHaveProperty("component");
    expect(JSON.stringify(c.filter)).not.toContain("component");
  });

  it(".sheet({ component, condition, className }) splits across the two halves", () => {
    const c = resolveColumn(
      col.string().label("Host").sheet({
        component: sheetComponent,
        condition: sheetCondition,
        className: "flex-col",
      }),
    );
    expect(c.sheet).toEqual({ className: "flex-col" });
    expect(c.renderers.sheetComponent).toBe(sheetComponent);
    expect(c.renderers.sheetCondition).toBe(sheetCondition);
  });

  it(".notFilterable() clears the filter component", () => {
    const c = resolveColumn(
      col
        .enum(["a", "b"] as const)
        .label("Kind")
        .filterable("checkbox", { component: filterComponent })
        .notFilterable(),
    );
    expect(c.filter).toBeNull();
    expect(c.renderers.filterComponent).toBeUndefined();
  });

  it(".sheetOnly() clears the filter component and hides the column", () => {
    const c = resolveColumn(
      col
        .enum(["a", "b"] as const)
        .label("Kind")
        .filterable("checkbox", { component: filterComponent })
        .sheetOnly(),
    );
    expect(c.filter).toBeNull();
    expect(c.hidden).toBe(true);
    expect(c.enableHiding).toBe(false);
    expect(c.renderers.filterComponent).toBeUndefined();
  });

  it(".sheetOnly() keeps the cell and sheet renderers", () => {
    const c = resolveColumn(
      col
        .record()
        .label("Headers")
        .display("custom", { cell })
        .sheet({ component: sheetComponent })
        .sheetOnly(),
    );
    expect(c.renderers.cell).toBe(cell);
    expect(c.renderers.sheetComponent).toBe(sheetComponent);
  });
});

// ── immutability ──────────────────────────────────────────────────────────────

describe("immutability", () => {
  it("every chained call returns a new builder and leaves the receiver untouched", () => {
    const base = col.number().label("Latency");
    const before = resolveColumn(base);

    const derived = [
      base.label("Other"),
      base.description("Round-trip time"),
      base.display("bar", { min: 0, max: 100 }),
      base.display("custom", { cell }),
      base.filterable("slider", { min: 0, max: 10 }),
      base.notFilterable(),
      base.defaultOpen(),
      base.commandDisabled(),
      base.hidden(),
      base.hideHeader(),
      base.resizable(),
      base.size(10),
      base.sortable(),
      base.optional(),
      base.sheet({ className: "flex-col" }),
      base.sheetOnly(),
    ];

    for (const d of derived) {
      expect(d).not.toBe(base);
      expect(resolveColumn(d)).not.toEqual(before);
    }
    expect(resolveColumn(base)).toEqual(before);
  });

  it("a no-op call still returns a fresh builder with equal state", () => {
    const base = col.string().label("Host").notFilterable();
    const next = base.defaultOpen();
    expect(next).not.toBe(base);
    expect(resolveColumn(next)).toEqual(resolveColumn(base));
  });

  it("renderers accumulate without mutating an earlier builder's renderers", () => {
    const base = col.string().label("Host");
    const withCell = base.display("custom", { cell });
    const withSheet = withCell.sheet({ component: sheetComponent });

    expect(resolveColumn(base).renderers.cell).toBeUndefined();
    expect(resolveColumn(withCell).renderers.sheetComponent).toBeUndefined();
    expect(resolveColumn(withSheet).renderers.cell).toBe(cell);
    expect(resolveColumn(withSheet).renderers.sheetComponent).toBe(
      sheetComponent,
    );
  });
});

// ── .filterable() option preservation ──────────────────────────────────────────

describe(".filterable() option preservation", () => {
  it("preserves existing options when called again with the same type and no new options", () => {
    const options = [{ label: "Error", value: "error" }];
    const c = resolveColumn(
      col
        .string()
        .label("Level")
        // @ts-expect-error - we're testing option preservation
        .filterable("input", { options })
        .filterable("input"), // no options — should preserve
    );
    expect(c.filter?.options).toEqual(options);
  });

  it("drops options when switching to a different filter type", () => {
    const options = [{ label: "Error", value: "error" }];
    const c = resolveColumn(
      col
        .number()
        .label("Count")
        .filterable("checkbox", { options })
        // @ts-expect-error - testing filter type switch (F narrowed to "checkbox")
        .filterable("input"), // type change — options not preserved
    );
    expect(c.filter?.options).toBeUndefined();
  });

  it("preserves defaultOpen and commandDisabled across a .filterable() call", () => {
    const c = resolveColumn(
      col
        .number()
        .label("Latency")
        .defaultOpen()
        .commandDisabled()
        .filterable("slider", { min: 0, max: 10 }),
    );
    expect(c.filter?.defaultOpen).toBe(true);
    expect(c.filter?.commandDisabled).toBe(true);
  });
});

// ── no-op guards ──────────────────────────────────────────────────────────────

describe(".defaultOpen() and .commandDisabled() on notFilterable column", () => {
  it(".defaultOpen() is a no-op when filter is null", () => {
    const c = resolveColumn(
      col.string().label("Host").notFilterable().defaultOpen(),
    );
    expect(c.filter).toBeNull();
  });

  it(".commandDisabled() is a no-op when filter is null", () => {
    const c = resolveColumn(
      col.string().label("Host").notFilterable().commandDisabled(),
    );
    expect(c.filter).toBeNull();
  });
});

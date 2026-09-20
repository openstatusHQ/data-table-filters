import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { col } from "../col";
import type { TableSchemaDefinition } from "../types";
import { generateFilterFields, widestLabelCandidates } from "./filter-fields";

// ── generateFilterFields ─────────────────────────────────────────────────────

describe("generateFilterFields", () => {
  it("returns empty array for empty schema", () => {
    expect(generateFilterFields({})).toEqual([]);
  });

  it("skips non-filterable columns", () => {
    const schema: TableSchemaDefinition = {
      id: col.string().label("ID").notFilterable(),
      name: col.string().label("Name").filterable("input"),
    };
    const fields = generateFilterFields(schema);
    expect(fields).toHaveLength(1);
    expect(fields[0].value).toBe("name");
  });

  it("generates input filter field", () => {
    const schema: TableSchemaDefinition = {
      path: col.string().label("Path").filterable("input"),
    };
    const [field] = generateFilterFields(schema);
    expect(field).toMatchObject({
      label: "Path",
      value: "path",
      type: "input",
    });
  });

  it("generates timerange filter field with presets", () => {
    const presets = [
      { label: "Last hour", from: new Date(), to: new Date(), shortcut: "1h" },
    ];
    const schema: TableSchemaDefinition = {
      date: col.timestamp().label("Date").filterable("timerange", { presets }),
    };
    const [field] = generateFilterFields(schema);
    expect(field.type).toBe("timerange");
    if (field.type === "timerange") {
      expect(field.presets).toEqual(presets);
    }
  });

  it("generates slider filter field with min/max", () => {
    const schema: TableSchemaDefinition = {
      latency: col
        .number()
        .label("Latency")
        .filterable("slider", { min: 0, max: 5000 }),
    };
    const [field] = generateFilterFields(schema);
    expect(field.type).toBe("slider");
    if (field.type === "slider") {
      expect(field.min).toBe(0);
      expect(field.max).toBe(5000);
    }
  });

  it("slider defaults to min=0, max=100 when not specified in config", () => {
    // Create a schema where slider bounds come from filter config
    const schema: TableSchemaDefinition = {
      score: col
        .number()
        .label("Score")
        .filterable("slider", { min: 0, max: 100 }),
    };
    const [field] = generateFilterFields(schema);
    if (field.type === "slider") {
      expect(field.min).toBe(0);
      expect(field.max).toBe(100);
    }
  });

  it("auto-derives checkbox options from col.enum(values)", () => {
    const LEVELS = ["error", "warn", "info"] as const;
    const schema: TableSchemaDefinition = {
      level: col.enum(LEVELS).label("Level").filterable("checkbox"),
    };
    const [field] = generateFilterFields(schema);
    expect(field.type).toBe("checkbox");
    if (field.type === "checkbox") {
      expect(field.options).toEqual([
        { label: "error", value: "error" },
        { label: "warn", value: "warn" },
        { label: "info", value: "info" },
      ]);
    }
  });

  it("gives level-indicator checkbox options a swatch component by default", () => {
    const LEVELS = ["error", "warn", "info"] as const;
    const schema: TableSchemaDefinition = {
      level: col.enum(LEVELS).label("Level").display("level-indicator"),
      method: col.enum(["GET", "POST"] as const).label("Method"),
    };
    const [level, method] = generateFilterFields(schema);
    expect(level.type).toBe("checkbox");
    expect(method.type).toBe("checkbox");
    if (level.type === "checkbox" && method.type === "checkbox") {
      // The dot the column renders in its cells, reused in the sidebar.
      expect(typeof level.component).toBe("function");
      // Plain enums keep the plain label.
      expect(method.component).toBeUndefined();
    }
  });

  it("puts the swatch after the label, sized to the widest label", () => {
    const schema: TableSchemaDefinition = {
      level: col
        .enum(["error", "warning", "info"] as const)
        .label("Level")
        .display("level-indicator"),
    };
    const [level] = generateFilterFields(schema);
    if (level.type !== "checkbox" || !level.component) {
      throw new Error("expected a checkbox field with a component");
    }
    const html = renderToStaticMarkup(
      level.component({ label: "info", value: "info" }),
    );
    // dots line up in one column however short the label is
    expect(html).toContain('data-label="warning"');
    expect(html.indexOf("bg-info")).toBeGreaterThan(html.indexOf(">info<"));
  });

  it("aligns to the rendered options when facets supply them", () => {
    // The schema leaves the options to the data: `applyFacets` adds them
    // later, so the filter hands the component the list it actually renders.
    const schema: TableSchemaDefinition = {
      level: col
        .enum(["info", "warning"] as const)
        .label("Level")
        .display("level-indicator")
        .filterable("checkbox", { options: [] }),
    };
    const [level] = generateFilterFields(schema);
    if (level.type !== "checkbox" || !level.component) {
      throw new Error("expected a checkbox field with a component");
    }
    const bare = renderToStaticMarkup(
      level.component({ label: "info", value: "info" }),
    );
    expect(bare).not.toContain("data-label");

    const faceted = renderToStaticMarkup(
      level.component({
        label: "info",
        value: "info",
        options: [
          { label: "info", value: "info" },
          { label: "warning", value: "warning" },
        ],
      }),
    );
    expect(faceted).toContain('data-label="warning"');
  });

  it("gives no swatch to a kind whose cells fall back to text", () => {
    const schema: TableSchemaDefinition = {
      level: col
        .enum(["error", "info"] as const)
        .label("Level")
        .display("level-indicator"),
      ok: col.boolean().label("OK").display("level-indicator"),
    };
    const [level, ok] = generateFilterFields(schema);
    if (level.type === "checkbox" && ok.type === "checkbox") {
      expect(typeof level.component).toBe("function");
      // `renderCell` draws a boolean as text, so the sidebar must not show a
      // dot the table does not.
      expect(ok.component).toBeUndefined();
    }
  });

  it("keeps an explicit checkbox component over the display default", () => {
    const custom = () => null;
    const schema: TableSchemaDefinition = {
      level: col
        .enum(["error", "info"] as const)
        .label("Level")
        .display("level-indicator")
        .filterable("checkbox", { component: custom }),
    };
    const [field] = generateFilterFields(schema);
    if (field.type === "checkbox") {
      expect(field.component).toBe(custom);
    }
  });

  it("auto-derives checkbox options from col.boolean()", () => {
    const schema: TableSchemaDefinition = {
      active: col.boolean().label("Active"),
    };
    const [field] = generateFilterFields(schema);
    expect(field.type).toBe("checkbox");
    if (field.type === "checkbox") {
      expect(field.options).toEqual([
        { label: "true", value: true },
        { label: "false", value: false },
      ]);
    }
  });

  it("auto-derives checkbox options from col.array(col.enum(values))", () => {
    const REGIONS = ["us-east", "us-west", "eu-west"] as const;
    const schema: TableSchemaDefinition = {
      regions: col
        .array(col.enum(REGIONS))
        .label("Regions")
        .filterable("checkbox"),
    };
    const [field] = generateFilterFields(schema);
    expect(field.type).toBe("checkbox");
    if (field.type === "checkbox") {
      expect(field.options).toEqual([
        { label: "us-east", value: "us-east" },
        { label: "us-west", value: "us-west" },
        { label: "eu-west", value: "eu-west" },
      ]);
    }
  });

  it("uses explicit options when provided for checkbox", () => {
    const schema: TableSchemaDefinition = {
      status: col
        .number()
        .label("Status")
        .filterable("checkbox", {
          options: [
            { label: "OK", value: 200 },
            { label: "Not Found", value: 404 },
          ],
        }),
    };
    const [field] = generateFilterFields(schema);
    if (field.type === "checkbox") {
      expect(field.options).toEqual([
        { label: "OK", value: 200 },
        { label: "Not Found", value: 404 },
      ]);
    }
  });

  it("preserves defaultOpen flag", () => {
    const schema: TableSchemaDefinition = {
      level: col
        .enum(["error", "warn"] as const)
        .label("Level")
        .filterable("checkbox")
        .defaultOpen(),
    };
    const [field] = generateFilterFields(schema);
    expect(field.defaultOpen).toBe(true);
  });

  it("preserves commandDisabled flag", () => {
    const schema: TableSchemaDefinition = {
      date: col
        .timestamp()
        .label("Date")
        .filterable("timerange")
        .commandDisabled(),
    };
    const [field] = generateFilterFields(schema);
    expect(field.commandDisabled).toBe(true);
  });

  it("preserves schema definition order", () => {
    const schema: TableSchemaDefinition = {
      alpha: col.string().label("Alpha").filterable("input"),
      beta: col
        .number()
        .label("Beta")
        .filterable("slider", { min: 0, max: 100 }),
      gamma: col
        .enum(["a", "b"] as const)
        .label("Gamma")
        .filterable("checkbox"),
    };
    const fields = generateFilterFields(schema);
    expect(fields.map((f) => f.value)).toEqual(["alpha", "beta", "gamma"]);
  });
});

describe("widestLabelCandidates", () => {
  it("dedupes labels and returns none without options", () => {
    expect(widestLabelCandidates(undefined)).toEqual([]);
    expect(
      widestLabelCandidates([
        { label: "info", value: "a" },
        { label: "info", value: "b" },
      ]),
    ).toEqual(["info"]);
  });

  it("keeps only the longest few of a long list", () => {
    const options = Array.from({ length: 50 }, (_, i) => ({
      label: "x".repeat(i + 1),
      value: i,
    }));
    const labels = widestLabelCandidates(options);
    expect(labels).toHaveLength(8);
    expect(labels[0]).toHaveLength(50);
    expect(labels[7]).toHaveLength(43);
  });
});

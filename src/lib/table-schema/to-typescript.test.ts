import { describe, expect, it } from "vitest";
import type { SchemaJSON, ColumnDescriptor } from "./types";
import { schemaToTypeScript } from "./to-typescript";

function makeCol(overrides: Partial<ColumnDescriptor>): ColumnDescriptor {
  return {
    key: "test",
    label: "Test",
    dataType: "string",
    optional: false,
    hidden: false,
    sortable: false,
    display: { type: "text" },
    filter: { type: "input", defaultOpen: false, commandDisabled: false },
    sheet: null,
    ...overrides,
  };
}

describe("schemaToTypeScript", () => {
  it("generates valid import and createTableSchema wrapper", () => {
    const json: SchemaJSON = { columns: [] };
    const ts = schemaToTypeScript(json);
    expect(ts).toContain('import { createTableSchema, col } from "@/lib/table-schema"');
    expect(ts).toContain("export const schema = createTableSchema({");
    expect(ts).toContain("});");
  });

  it("generates string column with input filter", () => {
    const json: SchemaJSON = {
      columns: [makeCol({ key: "path", label: "Path", dataType: "string" })],
    };
    const ts = schemaToTypeScript(json);
    expect(ts).toContain('col.string()');
    expect(ts).toContain('.label("Path")');
    expect(ts).toContain('.filterable("input")');
  });

  it("generates enum column with values", () => {
    const json: SchemaJSON = {
      columns: [
        makeCol({
          key: "level",
          label: "Level",
          dataType: "enum",
          enumValues: ["error", "warn", "info"],
          filter: { type: "checkbox", defaultOpen: false, commandDisabled: false },
        }),
      ],
    };
    const ts = schemaToTypeScript(json);
    expect(ts).toContain('col.enum(["error", "warn", "info"])');
    expect(ts).toContain('.filterable("checkbox")');
  });

  it("generates array(enum) column", () => {
    const json: SchemaJSON = {
      columns: [
        makeCol({
          key: "regions",
          label: "Regions",
          dataType: "array",
          arrayItemType: { dataType: "enum", enumValues: ["us", "eu"] },
          display: { type: "badge" },
          filter: { type: "checkbox", defaultOpen: false, commandDisabled: false },
        }),
      ],
    };
    const ts = schemaToTypeScript(json);
    expect(ts).toContain('col.array(col.enum(["us", "eu"]))');
  });

  it("generates slider filter with bounds", () => {
    const json: SchemaJSON = {
      columns: [
        makeCol({
          key: "latency",
          label: "Latency",
          dataType: "number",
          display: { type: "text" },
          filter: { type: "slider", min: 0, max: 5000, defaultOpen: false, commandDisabled: false },
        }),
      ],
    };
    const ts = schemaToTypeScript(json);
    expect(ts).toContain('.filterable("slider", { min: 0, max: 5000 })');
  });

  it("generates checkbox filter with options", () => {
    const json: SchemaJSON = {
      columns: [
        makeCol({
          key: "status",
          label: "Status",
          dataType: "number",
          display: { type: "number" },
          filter: {
            type: "checkbox",
            options: [{ label: "200", value: 200 }, { label: "404", value: 404 }],
            defaultOpen: false,
            commandDisabled: false,
          },
        }),
      ],
    };
    const ts = schemaToTypeScript(json);
    expect(ts).toContain('.filterable("checkbox", { options: [');
    expect(ts).toContain('{ label: "200", value: 200 }');
  });

  it("generates notFilterable for null filter", () => {
    const json: SchemaJSON = {
      columns: [
        makeCol({ key: "id", label: "ID", filter: null }),
      ],
    };
    const ts = schemaToTypeScript(json);
    expect(ts).toContain(".notFilterable()");
  });

  it("emits .sortable() when sortable=true", () => {
    const json: SchemaJSON = {
      columns: [makeCol({ key: "date", label: "Date", sortable: true })],
    };
    const ts = schemaToTypeScript(json);
    expect(ts).toContain(".sortable()");
  });

  it("emits .hidden() when hidden=true", () => {
    const json: SchemaJSON = {
      columns: [makeCol({ key: "id", label: "ID", hidden: true })],
    };
    const ts = schemaToTypeScript(json);
    expect(ts).toContain(".hidden()");
  });

  it("emits .optional() when optional=true", () => {
    const json: SchemaJSON = {
      columns: [makeCol({ key: "id", label: "ID", optional: true })],
    };
    const ts = schemaToTypeScript(json);
    expect(ts).toContain(".optional()");
  });

  it("emits .size() when size is set", () => {
    const json: SchemaJSON = {
      columns: [makeCol({ key: "id", label: "ID", size: 150 })],
    };
    const ts = schemaToTypeScript(json);
    expect(ts).toContain(".size(150)");
  });

  it("emits .sheet() when sheet is not null", () => {
    const json: SchemaJSON = {
      columns: [makeCol({ key: "id", label: "ID", sheet: {} })],
    };
    const ts = schemaToTypeScript(json);
    expect(ts).toContain(".sheet()");
  });

  it("emits .sheet() with options", () => {
    const json: SchemaJSON = {
      columns: [
        makeCol({
          key: "id",
          label: "ID",
          sheet: { label: "Request ID", className: "font-mono" },
        }),
      ],
    };
    const ts = schemaToTypeScript(json);
    expect(ts).toContain('.sheet({ label: "Request ID", className: "font-mono" })');
  });

  it("emits .defaultOpen() when filter has defaultOpen=true", () => {
    const json: SchemaJSON = {
      columns: [
        makeCol({
          key: "level",
          label: "Level",
          filter: { type: "checkbox", defaultOpen: true, commandDisabled: false },
        }),
      ],
    };
    const ts = schemaToTypeScript(json);
    expect(ts).toContain(".defaultOpen()");
  });

  it("emits .commandDisabled() when filter has commandDisabled=true", () => {
    const json: SchemaJSON = {
      columns: [
        makeCol({
          key: "date",
          label: "Date",
          filter: { type: "timerange", defaultOpen: false, commandDisabled: true },
        }),
      ],
    };
    const ts = schemaToTypeScript(json);
    expect(ts).toContain(".commandDisabled()");
  });

  // -- preset detection --

  it("detects traceId preset (string + code + no filter)", () => {
    const json: SchemaJSON = {
      columns: [
        makeCol({
          key: "traceId",
          label: "Trace ID",
          dataType: "string",
          display: { type: "code" },
          filter: null,
        }),
      ],
    };
    const ts = schemaToTypeScript(json);
    expect(ts).toContain("col.presets.traceId()");
    expect(ts).not.toContain('.display("code")');
    expect(ts).not.toContain(".notFilterable()");
  });

  it("detects timestamp preset (timestamp + sortable)", () => {
    const json: SchemaJSON = {
      columns: [
        makeCol({
          key: "date",
          label: "Date",
          dataType: "timestamp",
          sortable: true,
          display: { type: "timestamp" },
          filter: { type: "timerange", defaultOpen: false, commandDisabled: false },
        }),
      ],
    };
    const ts = schemaToTypeScript(json);
    expect(ts).toContain("col.presets.timestamp()");
    expect(ts).not.toContain(".sortable()");
  });

  it("detects duration preset (number + slider + number display)", () => {
    const json: SchemaJSON = {
      columns: [
        makeCol({
          key: "latency",
          label: "Latency",
          dataType: "number",
          display: { type: "number", unit: "ms" },
          filter: { type: "slider", min: 0, max: 5000, defaultOpen: false, commandDisabled: false },
        }),
      ],
    };
    const ts = schemaToTypeScript(json);
    expect(ts).toContain('col.presets.duration("ms")');
  });

  it("detects duration preset with custom bounds", () => {
    const json: SchemaJSON = {
      columns: [
        makeCol({
          key: "latency",
          label: "Latency",
          dataType: "number",
          display: { type: "number", unit: "s" },
          filter: { type: "slider", min: 0, max: 60, defaultOpen: false, commandDisabled: false },
        }),
      ],
    };
    const ts = schemaToTypeScript(json);
    expect(ts).toContain('col.presets.duration("s", { min: 0, max: 60 })');
  });

  it("skips default text display for strings", () => {
    const json: SchemaJSON = {
      columns: [makeCol({ key: "name", label: "Name", display: { type: "text" } })],
    };
    const ts = schemaToTypeScript(json);
    expect(ts).not.toContain('.display("text")');
  });

  it("emits non-default display types", () => {
    const json: SchemaJSON = {
      columns: [
        makeCol({ key: "level", label: "Level", dataType: "enum", enumValues: ["a"], display: { type: "badge" } }),
      ],
    };
    const ts = schemaToTypeScript(json);
    expect(ts).toContain('.display("badge")');
  });
});

import {
  DataTableCellBadge,
  DataTableCellHeatmap,
  DataTableCellNumber,
  DataTableCellText,
} from "@dtf/registry/components/data-table/data-table-cell";
import { DataTableColumnHeader } from "@dtf/registry/components/data-table/data-table-column-header";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { col } from "../col";
import { createTableSchema } from "../index";
import { inferSchemaFromJSON } from "../infer";
import type { TableSchemaDefinition } from "../types";
import { generateColumns } from "./columns";
import { generateSheetFields } from "./sheet-fields";

// ── Test harness ─────────────────────────────────────────────────────────────
//
// The registry's vitest environment is "node" (see `vitest.config.ts`) and there
// is no DOM renderer in the workspace, so cells are NOT rendered. Instead the
// `cell` callback is invoked with a stub TanStack context and the returned React
// element is inspected structurally (`type` / `props`). That is enough to pin
// which cell component a display descriptor selects and what it is handed.

/**
 * A structural read view of the ColumnDefs `generateColumns` produces.
 *
 * `ColumnDef` is a discriminated union whose `accessorKey`/`accessorFn` arms
 * cannot both be read without narrowing, and `meta` is an empty interface unless
 * the consumer augments it. Tests want to assert on the shape that was actually
 * built, so they read through this instead.
 */
type ColumnDefRead = {
  id?: string;
  accessorKey?: string;
  accessorFn?: (row: unknown) => unknown;
  header?: unknown;
  cell?: unknown;
  filterFn?: GeneratedFilterFn;
  size?: number;
  minSize?: number;
  maxSize?: number;
  enableResizing?: boolean;
  enableSorting?: boolean;
  enableHiding?: boolean;
  meta?: { label?: string; kind?: string; hidden?: boolean };
};

/**
 * The `filterFn` a ColumnDef now carries.
 *
 * It is a *function* from the shared filter-semantics module, not one of the
 * string names (`"arrSome"`, `"inDateRange"`, …) that used to require a matching
 * `filterFns: { … }` registration on the table. There is nothing to assert about
 * its identity, so the tests assert what it does.
 */
type GeneratedFilterFn = (
  row: { getValue: (id: string) => unknown },
  columnId: string,
  value: unknown,
) => boolean;

type AnyElement = ReactElement<Record<string, unknown>>;

type CellContextStub = {
  getValue: () => unknown;
  row: { original: unknown };
  column: { getFacetedMinMaxValues?: () => [number, number] | undefined };
};

function defs(definition: TableSchemaDefinition): ColumnDefRead[] {
  return generateColumns(definition) as unknown as ColumnDefRead[];
}

function defsByKey(
  definition: TableSchemaDefinition,
): Record<string, ColumnDefRead> {
  const out: Record<string, ColumnDefRead> = {};
  for (const d of defs(definition)) {
    out[d.accessorKey ?? d.id ?? ""] = d;
  }
  return out;
}

function invokeCell(
  def: ColumnDefRead,
  context: Partial<CellContextStub> = {},
): AnyElement | null {
  const cell = def.cell as unknown as (
    ctx: CellContextStub,
  ) => AnyElement | null;
  return cell({
    getValue: context.getValue ?? (() => undefined),
    row: context.row ?? { original: {} },
    column: context.column ?? {},
  });
}

/**
 * Run a generated `filterFn` over one cell value and report whether the row
 * survives. TanStack calls the predicate with the row accessor, so the cell is
 * handed over through a `getValue` stub.
 */
function keeps(
  def: ColumnDefRead,
  cell: unknown,
  filterValue: unknown,
): boolean {
  const filterFn = def.filterFn;
  if (!filterFn) throw new Error("column has no filterFn");
  return filterFn({ getValue: () => cell }, "column", filterValue);
}

function invokeHeader(
  def: ColumnDefRead,
  context: Record<string, unknown> = {},
): AnyElement {
  const header = def.header as unknown as (ctx: unknown) => AnyElement;
  return header(context);
}

// ── raw rows → inferred schema → ColumnDef[] ─────────────────────────────────
//
// The end-to-end path a consumer actually walks: plain data in, table config out.

const RAW_ROWS = Array.from({ length: 12 }, (_, i) => ({
  id: `req_${i}`,
  host: `host-${i}.example.com`,
  level: (["error", "warn", "info"] as const)[i % 3]!,
  latency: 100 + i * 10,
  "timing.dns": i,
  createdAt: `2024-01-${String(i + 1).padStart(2, "0")}T00:00:00Z`,
  traceId: `trace_${i}`,
  tags: i % 2 === 0 ? ["edge", "cache"] : ["edge"],
}));

function inferredDefinition(): TableSchemaDefinition {
  return createTableSchema.fromJSON(inferSchemaFromJSON(RAW_ROWS)).definition;
}

describe("generateColumns — raw rows → usable table config", () => {
  it("produces one ColumnDef per key, in insertion order", () => {
    const columns = defs(inferredDefinition());
    expect(columns.map((c) => c.accessorKey ?? c.id)).toEqual([
      "id",
      "host",
      "level",
      "latency",
      "timing.dns",
      "createdAt",
      "traceId",
      "tags",
    ]);
  });

  it("uses accessorKey (and no accessorFn) for plain keys", () => {
    const byKey = defsByKey(inferredDefinition());
    expect(byKey.host!.accessorKey).toBe("host");
    expect(byKey.host!.accessorFn).toBeUndefined();
    expect(byKey.host!.id).toBeUndefined();
  });

  it("uses id + accessorFn for dotted keys, reading the flat property", () => {
    const byKey = defsByKey(inferredDefinition());
    const dotted = byKey["timing.dns"]!;
    expect(dotted.id).toBe("timing.dns");
    expect(dotted.accessorKey).toBeUndefined();
    expect(typeof dotted.accessorFn).toBe("function");
    expect(dotted.accessorFn!(RAW_ROWS[3]!)).toBe(3);
  });

  it("populates meta.label / meta.kind / meta.hidden", () => {
    const byKey = defsByKey(inferredDefinition());
    expect(byKey.level!.meta).toEqual({
      label: "Level",
      kind: "enum",
      hidden: false,
    });
    expect(byKey.createdAt!.meta).toEqual({
      label: "Created At",
      kind: "timestamp",
      hidden: false,
    });
    // traceId is hidden by the inference heuristics — meta must carry that.
    expect(byKey.traceId!.meta).toEqual({
      label: "Trace Id",
      kind: "string",
      hidden: true,
    });
  });

  it("derives a working filterFn per column from the inferred filter types", () => {
    const byKey = defsByKey(inferredDefinition());

    // string → case-insensitive substring
    expect(keeps(byKey.id!, "req_7", "REQ_7")).toBe(true);
    expect(keeps(byKey.id!, "req_7", "req_8")).toBe(false);

    // enum → set membership
    expect(keeps(byKey.level!, "error", ["error", "warn"])).toBe(true);
    expect(keeps(byKey.level!, "info", ["error", "warn"])).toBe(false);

    // number + slider → inclusive range
    expect(keeps(byKey.latency!, 150, [100, 200])).toBe(true);
    expect(keeps(byKey.latency!, 250, [100, 200])).toBe(false);

    // timestamp → inclusive date range
    const range = [
      new Date("2024-01-01T00:00:00Z"),
      new Date("2024-01-05T00:00:00Z"),
    ];
    expect(
      keeps(byKey.createdAt!, new Date("2024-01-03T00:00:00Z"), range),
    ).toBe(true);
    expect(
      keeps(byKey.createdAt!, new Date("2024-01-09T00:00:00Z"), range),
    ).toBe(false);

    // array → set overlap, including on a non-first element
    expect(keeps(byKey.tags!, ["edge", "cache"], ["cache"])).toBe(true);
    expect(keeps(byKey.tags!, ["edge"], ["cache"])).toBe(false);

    // traceId loses its filter during inference → no filterFn at all.
    expect(byKey.traceId!.filterFn).toBeUndefined();
  });

  it("produces cells that render the inferred display", () => {
    const byKey = defsByKey(inferredDefinition());
    const element = invokeCell(byKey.latency!, { getValue: () => 150 });
    // latency infers a heatmap with an "ms" unit and slider-derived bounds.
    expect(element?.type).toBe(DataTableCellHeatmap);
    expect(element?.props).toMatchObject({ value: 150, unit: "ms" });
  });
});

// ── filterFn derivation ──────────────────────────────────────────────────────

describe("generateColumns — filterFn derivation", () => {
  it("timerange filters by a date range, inclusive on both ends", () => {
    const [def] = defs({
      date: col.timestamp().label("Date").filterable("timerange"),
    });
    const range = [
      new Date("2024-03-01T00:00:00Z"),
      new Date("2024-03-31T00:00:00Z"),
    ];
    expect(keeps(def!, new Date("2024-03-15T12:00:00Z"), range)).toBe(true);
    expect(keeps(def!, new Date("2024-03-01T00:00:00Z"), range)).toBe(true);
    expect(keeps(def!, new Date("2024-03-31T00:00:00Z"), range)).toBe(true);
    expect(keeps(def!, new Date("2024-04-02T00:00:00Z"), range)).toBe(false);
  });

  it("slider filters by a number range, inclusive on both ends", () => {
    const [def] = defs({
      latency: col
        .number()
        .label("Latency")
        .filterable("slider", { min: 0, max: 100 }),
    });
    expect(keeps(def!, 50, [10, 60])).toBe(true);
    expect(keeps(def!, 10, [10, 60])).toBe(true);
    expect(keeps(def!, 60, [10, 60])).toBe(true);
    expect(keeps(def!, 5, [10, 60])).toBe(false);
    // A single handle is a degenerate range, not an equality on a stringified
    // number.
    expect(keeps(def!, 42, [42])).toBe(true);
    expect(keeps(def!, 43, [42])).toBe(false);
  });

  it("input on a string column filters by case-insensitive substring", () => {
    const [def] = defs({
      host: col.string().label("Host").filterable("input"),
    });
    expect(keeps(def!, "ALPHA.example.com", "alpha")).toBe(true);
    expect(keeps(def!, "beta.example.com", "EXAMPLE")).toBe(true);
    expect(keeps(def!, "beta.example.com", "alpha")).toBe(false);
  });

  it("input on a number column filters by equality, not substring", () => {
    const [def] = defs({
      port: col.number().label("Port").filterable("input"),
    });
    expect(keeps(def!, 5, 5)).toBe(true);
    // "5" used to substring-match a stringified 1500 on the client only.
    expect(keeps(def!, 1500, 5)).toBe(false);
  });

  it("checkbox on a scalar column filters by set membership", () => {
    const byKey = defsByKey({
      level: col.enum(["error", "warn"] as const).label("Level"),
      active: col.boolean().label("Active"),
      status: col.number().label("Status").filterable("checkbox"),
    });

    expect(keeps(byKey.level!, "error", ["error"])).toBe(true);
    expect(keeps(byKey.level!, "warn", ["error"])).toBe(false);

    expect(keeps(byKey.active!, true, [true])).toBe(true);
    expect(keeps(byKey.active!, false, [true])).toBe(false);

    // The shipping bug, at the generator boundary: two selected numbers are a
    // set, never `BETWEEN 200 AND 500`.
    expect(keeps(byKey.status!, 200, [200, 500])).toBe(true);
    expect(keeps(byKey.status!, 500, [200, 500])).toBe(true);
    expect(keeps(byKey.status!, 404, [200, 500])).toBe(false);
  });

  it("checkbox on an array column filters by set overlap", () => {
    const [def] = defs({
      tags: col
        .array(col.enum(["edge", "cache"] as const))
        .label("Tags")
        .filterable("checkbox"),
    });
    // The match is at index 1 — comparing only the first element misses it.
    expect(keeps(def!, ["edge", "cache"], ["cache"])).toBe(true);
    expect(keeps(def!, ["edge"], ["cache"])).toBe(false);
    expect(keeps(def!, [], ["cache"])).toBe(false);
  });

  it("omits filterFn when the column is not filterable", () => {
    const byKey = defsByKey({
      traceId: col.string().label("Trace ID").notFilterable(),
      headers: col.record().label("Headers"),
    });
    expect(byKey.traceId!.filterFn).toBeUndefined();
    expect(byKey.headers!.filterFn).toBeUndefined();
  });
});

// ── select column ────────────────────────────────────────────────────────────

describe("generateColumns — select column", () => {
  it("is not sortable, hideable, or resizable, and is locked to a fixed size", () => {
    const [def] = defs({ select: col.select() });
    expect(def!.id).toBe("select");
    expect(def!.accessorKey).toBeUndefined();
    expect(def!.enableSorting).toBe(false);
    expect(def!.enableHiding).toBe(false);
    expect(def!.enableResizing).toBe(false);
    expect(def!.size).toBe(40);
    expect(def!.minSize).toBe(40);
    expect(def!.maxSize).toBe(40);
    expect(def!.meta).toEqual({
      label: "Select",
      kind: "select",
      hidden: false,
    });
  });

  it("honours an explicit .size() on all three size bounds", () => {
    const [def] = defs({ select: col.select().size(56) });
    expect([def!.size, def!.minSize, def!.maxSize]).toEqual([56, 56, 56]);
  });

  it("renders checkbox header and cell functions", () => {
    const [def] = defs({ select: col.select() });
    expect(typeof def!.header).toBe("function");
    expect(typeof def!.cell).toBe("function");
  });
});

// ── sizing ───────────────────────────────────────────────────────────────────

describe("generateColumns — sizing", () => {
  it("locks size === minSize when the column is not resizable", () => {
    const [def] = defs({ host: col.string().label("Host").size(125) });
    expect(def!.size).toBe(125);
    expect(def!.minSize).toBe(125);
    expect(def!.enableResizing).toBe(false);
  });

  it("sets only size (initial width) when the column is resizable", () => {
    const [def] = defs({
      host: col.string().label("Host").size(125).resizable(),
    });
    expect(def!.size).toBe(125);
    expect(def!.minSize).toBeUndefined();
    expect(def!.enableResizing).toBe(true);
  });

  it("omits size entirely when .size() was never called", () => {
    const [def] = defs({ host: col.string().label("Host") });
    expect(def!.size).toBeUndefined();
    expect(def!.minSize).toBeUndefined();
  });

  it("forwards enableHiding: false, and omits it otherwise", () => {
    const byKey = defsByKey({
      headers: col.record().label("Headers").sheetOnly(),
      host: col.string().label("Host"),
    });
    expect(byKey.headers!.enableHiding).toBe(false);
    expect(byKey.host!.enableHiding).toBeUndefined();
  });
});

// ── header ───────────────────────────────────────────────────────────────────

describe("generateColumns — header", () => {
  it("uses the plain label string by default", () => {
    const [def] = defs({ host: col.string().label("Host") });
    expect(def!.header).toBe("Host");
  });

  it("renders an sr-only label when .hideHeader() is set", () => {
    const [def] = defs({
      level: col
        .enum(["a"] as const)
        .label("Level")
        .hideHeader(),
    });
    expect(typeof def!.header).toBe("function");
    const element = invokeHeader(def!);
    expect(element.type).toBe("span");
    expect(element.props).toMatchObject({
      className: "sr-only",
      children: "Level",
    });
  });

  it("renders a DataTableColumnHeader when .sortable() is set", () => {
    const [def] = defs({ date: col.timestamp().label("Date").sortable() });
    expect(typeof def!.header).toBe("function");
    const columnStub = {};
    const element = invokeHeader(def!, { column: columnStub });
    expect(element.type).toBe(DataTableColumnHeader);
    expect(element.props).toMatchObject({ title: "Date", column: columnStub });
  });

  it("prefers hideHeader over sortable when both are set", () => {
    const [def] = defs({
      level: col
        .enum(["a"] as const)
        .label("Level")
        .sortable()
        .hideHeader(),
    });
    expect(invokeHeader(def!).type).toBe("span");
  });
});

// ── cell rendering ───────────────────────────────────────────────────────────

describe("generateColumns — cell rendering", () => {
  it("renders text display through DataTableCellText", () => {
    const [def] = defs({ host: col.string().label("Host") });
    const element = invokeCell(def!, { getValue: () => "alpha.example.com" });
    expect(element?.type).toBe(DataTableCellText);
    expect(element?.props).toMatchObject({ value: "alpha.example.com" });
  });

  it("carries the display unit into DataTableCellNumber", () => {
    const [def] = defs({
      latency: col.number().label("Latency").display("number", { unit: "ms" }),
    });
    const element = invokeCell(def!, { getValue: () => 120 });
    expect(element?.type).toBe(DataTableCellNumber);
    expect(element?.props).toMatchObject({ value: 120, unit: "ms" });
  });

  it("applies colorMap entries to the rendered cell", () => {
    const [def] = defs({
      status: col
        .enum(["ok", "bad"] as const)
        .label("Status")
        .display("badge", { colorMap: { ok: "#22c55e", bad: "#ef4444" } }),
    });
    const element = invokeCell(def!, { getValue: () => "bad" });
    expect(element?.type).toBe(DataTableCellBadge);
    expect(element?.props).toMatchObject({ value: "bad", color: "#ef4444" });
  });

  it("renders one badge per item for array values", () => {
    const [def] = defs({
      tags: col.array(col.enum(["edge", "cache"] as const)).label("Tags"),
    });
    const element = invokeCell(def!, { getValue: () => ["edge", "cache"] });
    expect(element?.type).toBe("div");
    const children = element?.props.children as AnyElement[];
    expect(children).toHaveLength(2);
    expect(children.map((c) => c.type)).toEqual([
      DataTableCellBadge,
      DataTableCellBadge,
    ]);
    expect(children.map((c) => c.props.value)).toEqual(["edge", "cache"]);
  });

  it("falls back to DataTableCellText when the value does not match the display", () => {
    const [def] = defs({
      latency: col.number().label("Latency").display("number", { unit: "ms" }),
    });
    const element = invokeCell(def!, { getValue: () => "n/a" });
    expect(element?.type).toBe(DataTableCellText);
    expect(element?.props).toMatchObject({ value: "n/a" });
  });

  it("uses the display bounds for range displays when no facets exist", () => {
    const [def] = defs({
      latency: col
        .number()
        .label("Latency")
        .display("heatmap", { min: 0, max: 500 }),
    });
    const element = invokeCell(def!, { getValue: () => 250 });
    expect(element?.type).toBe(DataTableCellHeatmap);
    expect(element?.props).toMatchObject({ value: 250, min: 0, max: 500 });
  });

  it("prefers faceted min/max over the display bounds", () => {
    const [def] = defs({
      latency: col
        .number()
        .label("Latency")
        .display("heatmap", { min: 0, max: 500 }),
    });
    const element = invokeCell(def!, {
      getValue: () => 250,
      column: { getFacetedMinMaxValues: () => [40, 300] },
    });
    expect(element?.props).toMatchObject({ min: 40, max: 300 });
  });

  it("passes the whole row to a custom cell renderer", () => {
    const row = { host: "alpha", latency: 120 };
    const [def] = defs({
      host: col
        .string()
        .label("Host")
        .display("custom", {
          cell: (value, rowData) => (
            <span>
              {String(value)}:{String((rowData as typeof row).latency)}
            </span>
          ),
        }),
    });
    const element = invokeCell(def!, {
      getValue: () => "alpha",
      row: { original: row },
    });
    expect(element?.type).toBe("span");
    expect(element?.props.children).toEqual(["alpha", ":", "120"]);
  });
});

// ── custom renderer vs. serializable descriptor ──────────────────────────────

describe("generateColumns — custom renderer wins, descriptor stays real", () => {
  const LEVELS = ["error", "warn", "info"] as const;

  function schema(): TableSchemaDefinition {
    return {
      level: col
        .enum(LEVELS)
        .label("L")
        .display("custom", { cell: () => <span data-slot="custom-level" /> })
        .sheet(),
    };
  }

  it("uses the custom renderer for the table cell", () => {
    const [def] = defs(schema());
    const element = invokeCell(def!, { getValue: () => "error" });
    expect(element?.type).toBe("span");
    expect(element?.props).toMatchObject({ "data-slot": "custom-level" });
  });

  it("still reports the kind's serializable display to the sheet", () => {
    const [field] = generateSheetFields(schema());
    // Not "text": a custom cell no longer overwrites the descriptor's display,
    // so the enum default (badge) survives for the sheet and for toJSON().
    expect(field!.display).toEqual({ type: "badge" });
  });

  it("keeps the descriptor display serializable in toJSON()", () => {
    const json = createTableSchema(schema()).toJSON();
    expect(json.columns[0]!.display).toEqual({ type: "badge" });
  });

  it("merges a colorMap passed alongside a custom cell into the descriptor", () => {
    const definition: TableSchemaDefinition = {
      level: col
        .enum(LEVELS)
        .label("L")
        .display("custom", {
          cell: () => <span />,
          colorMap: { error: "#ef4444" },
        })
        .sheet(),
    };
    const [field] = generateSheetFields(definition);
    expect(field!.display).toEqual({
      type: "badge",
      colorMap: { error: "#ef4444" },
    });
  });
});

import type { DataTableFilterField } from "@dtf/registry/components/data-table/types";
import { describe, expect, it } from "vitest";
import { applyFacets } from "./faceted";
import type { FacetMetadataSchema } from "./types";

type Row = Record<string, unknown>;

function checkbox(
  value: string,
  options?: { label: string; value: string | number | boolean }[],
): DataTableFilterField<Row> {
  return {
    label: value,
    value,
    type: "checkbox",
    ...(options ? { options } : {}),
  } as DataTableFilterField<Row>;
}

function slider(
  value: string,
  bounds?: { min: number; max: number },
): DataTableFilterField<Row> {
  return {
    label: value,
    value,
    type: "slider",
    min: bounds?.min ?? 0,
    max: bounds?.max ?? 100,
  } as DataTableFilterField<Row>;
}

function facet(
  rows: { value: unknown; total: number }[],
  bounds?: { min?: number; max?: number },
): FacetMetadataSchema {
  return {
    rows,
    total: rows.reduce((sum, row) => sum + row.total, 0),
    ...bounds,
  };
}

describe("applyFacets", () => {
  it("returns the fields untouched when there are no facets", () => {
    const fields = [checkbox("level")];
    expect(applyFacets(fields, undefined)).toBe(fields);
  });

  it("fills checkbox options from the facet rows", () => {
    const [field] = applyFacets([checkbox("level")], {
      level: facet([
        { value: "error", total: 3 },
        { value: "info", total: 9 },
      ]),
    });

    expect(field).toMatchObject({
      value: "level",
      options: [
        { label: "error", value: "error" },
        { label: "info", value: "info" },
      ],
    });
  });

  it("keeps options the schema already declared", () => {
    // A schema that spelled out its enum is stating the domain; the facet only
    // reports what happens to be present in the rows loaded so far.
    const declared = [
      { label: "error", value: "error" },
      { label: "warn", value: "warn" },
      { label: "info", value: "info" },
    ];
    const [field] = applyFacets([checkbox("level", declared)], {
      level: facet([{ value: "error", total: 3 }]),
    });

    expect((field as { options: unknown }).options).toBe(declared);
  });

  it("fills slider bounds from the facet", () => {
    const [field] = applyFacets([slider("latency")], {
      latency: facet([], { min: 12, max: 3400 }),
    });

    expect(field).toMatchObject({ min: 12, max: 3400 });
  });

  it("keeps the field's own bounds when the facet reports none", () => {
    const [field] = applyFacets([slider("latency", { min: 5, max: 50 })], {
      latency: facet([]),
    });

    expect(field).toMatchObject({ min: 5, max: 50 });
  });

  it("leaves a field with no matching facet alone", () => {
    const fields = [checkbox("level"), checkbox("region")];
    const result = applyFacets(fields, {
      level: facet([{ value: "error", total: 1 }]),
    });

    expect(result[1]).toBe(fields[1]);
  });

  it("stringifies non-string facet values for the label", () => {
    const [field] = applyFacets([checkbox("status")], {
      status: facet([
        { value: 200, total: 5 },
        { value: true, total: 1 },
      ]),
    });

    expect((field as { options: { label: string }[] }).options).toEqual([
      { label: "200", value: 200 },
      { label: "true", value: true },
    ]);
  });

  it("treats an empty options array as unset and fills it", () => {
    const [field] = applyFacets([checkbox("level", [])], {
      level: facet([{ value: "error", total: 1 }]),
    });

    expect((field as { options: unknown[] }).options).toHaveLength(1);
  });

  it("survives a facet with no rows array", () => {
    const [field] = applyFacets([checkbox("level")], {
      level: { total: 0 } as unknown as FacetMetadataSchema,
    });

    expect((field as { options: unknown[] }).options).toEqual([]);
  });
});

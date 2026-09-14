import type { DataTableFilterField } from "@dtf/registry/components/data-table/types";
import type { RowData, RowModel, Table as TTable } from "@tanstack/react-table";
import type { FacetMetadataSchema } from "./types";

/**
 * Drop-in replacement for TanStack's `createFacetedUniqueValues` that flattens
 * array column values. The built-in version treats `["a", "b"]` as one unique
 * value; this version counts each item individually.
 *
 * Works for both array and non-array columns.
 *
 * The signature mirrors `createFacetedUniqueValues` so this can be handed to the
 * `facetedUniqueValues` slot on `tableFeatures()` in its place — which is the
 * only way it is ever used. `TFeatures` is `any` because the slot itself is
 * untyped (`(table: any, columnId: string) => ...`) and because naming the
 * concrete feature set here would make this module import the features module
 * that already imports it.
 */
export function getFacetedUniqueValuesFlattened<
  TData extends RowData = any,
>(): (table: TTable<any, TData>, columnId: string) => () => Map<any, number> {
  return (table, columnId) => {
    return () => {
      const facetedRowModel: RowModel<any, TData> | undefined = table
        .getColumn(columnId)
        ?.getFacetedRowModel();
      if (!facetedRowModel) return new Map();

      const counts = new Map<unknown, number>();
      for (const row of facetedRowModel.flatRows) {
        const value = row.getValue(columnId);
        if (Array.isArray(value)) {
          for (const item of value) {
            counts.set(item, (counts.get(item) ?? 0) + 1);
          }
        } else if (value != null) {
          counts.set(value, (counts.get(value) ?? 0) + 1);
        }
      }
      return counts;
    };
  };
}

/**
 * Reads pre-computed facets off a server response.
 *
 * The table argument is accepted only to match the shape the data-table
 * provider expects and is deliberately typed `unknown`: these helpers never
 * touch it. That also keeps them assignable whatever feature set the calling
 * table was built from — `TFeatures` is invariant in v9, so naming a concrete
 * one here would lock out customised tables.
 */
export function getFacetedUniqueValues(
  facets?: Record<string, FacetMetadataSchema>,
) {
  return (_: unknown, columnId: string): Map<string, number> => {
    return new Map(
      facets?.[columnId]?.rows?.map(({ value, total }) => [value, total]) || [],
    );
  };
}

export function getFacetedMinMaxValues(
  facets?: Record<string, FacetMetadataSchema>,
) {
  return (_: unknown, columnId: string): [number, number] | undefined => {
    const min = facets?.[columnId]?.min;
    const max = facets?.[columnId]?.max;
    if (typeof min === "number" && typeof max === "number") return [min, max];
    if (typeof min === "number") return [min, min];
    if (typeof max === "number") return [max, max];
    return undefined;
  };
}

/**
 * Fold server-computed facets into the filter fields.
 *
 * A checkbox filter needs its options and a slider needs its bounds, and
 * neither is knowable from the schema alone — they depend on the data. Both
 * the `/drizzle` client and the schema builder had grown their own copy of
 * this merge, which is exactly the sort of thing a table pointed at an
 * endpoint has to do for itself.
 *
 * A field that already carries options keeps them: a schema that spelled out
 * its enum values is stating the domain, which is a stronger claim than
 * "these are the values present in the rows we happened to load".
 */
export function applyFacets<TData>(
  filterFields: readonly DataTableFilterField<TData>[],
  facets: Record<string, FacetMetadataSchema> | undefined,
): DataTableFilterField<TData>[] {
  if (!facets) return filterFields as DataTableFilterField<TData>[];

  return filterFields.map((field) => {
    const facet = facets[field.value as string];
    if (!facet) return field;
    if ("options" in field && field.options && field.options.length > 0) {
      return field;
    }

    const options = (facet.rows ?? []).map(({ value }) => ({
      label: `${value}`,
      value: value as string | number | boolean,
    }));

    if (field.type === "slider") {
      return {
        ...field,
        min: facet.min ?? field.min,
        max: facet.max ?? field.max,
        options,
      };
    }

    return { ...field, options };
  });
}

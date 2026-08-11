import type { FacetMetadataSchema } from "@dtf/registry/lib/data-table/types";
import { defineFilters } from "@dtf/registry/lib/filters";
import {
  createTableSchema,
  resolveColumn,
  resolveColumns,
} from "@dtf/registry/lib/table-schema";
import type {
  SchemaJSON,
  TableSchemaDefinition,
} from "@dtf/registry/lib/table-schema";

/**
 * Filter builder data using the schema's declared semantics.
 *
 * This used to be a third hand-written engine, dispatching on
 * `filterConfig.type` with its own case-sensitivity and array rules. It now
 * shares one interpretation with the SQL and TanStack engines.
 */
export function filterGenericData(
  data: Record<string, unknown>[],
  filterValues: Record<string, unknown>,
  schema: TableSchemaDefinition,
): Record<string, unknown>[] {
  return defineFilters(schema).apply(data, filterValues);
}

/**
 * Generic sorting for builder data.
 */
export function sortGenericData(
  data: Record<string, unknown>[],
  sort: { id: string; desc: boolean } | null,
): Record<string, unknown>[] {
  if (!sort) return data;
  return [...data].sort((a, b) => {
    const aVal = a[sort.id];
    const bVal = b[sort.id];

    // Handle nullish values
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return sort.desc ? 1 : -1;
    if (bVal == null) return sort.desc ? -1 : 1;

    // Compare
    if (sort.desc) {
      return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
    }
    return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
  });
}

/**
 * Compute facets from data for all filterable columns.
 *
 * - Row counts are derived from `filteredData` so they reflect active filters.
 * - Min/max are derived from `allData` so slider ranges stay stable.
 */
export function getGenericFacets(
  filteredData: Record<string, unknown>[],
  allData: Record<string, unknown>[],
  schema: TableSchemaDefinition,
): Record<string, FacetMetadataSchema> {
  const filterableColumns = resolveColumns(schema).filter(
    (column) => column.filter !== null,
  );
  const filterableKeys = filterableColumns.map((column) => column.key);

  // Track which columns are booleans so we can preserve their type
  const booleanKeys = new Set(
    filterableColumns
      .filter((column) => column.kind === "boolean")
      .map((column) => column.key),
  );

  // Count values from filtered data
  const valuesMap = new Map<string, Map<string, number>>();
  for (const row of filteredData) {
    for (const key of filterableKeys) {
      const rawValue = row[key];
      if (rawValue === undefined || rawValue === null) continue;

      const values = Array.isArray(rawValue)
        ? rawValue.map(String)
        : [String(rawValue)];

      if (!valuesMap.has(key)) {
        valuesMap.set(key, new Map());
      }
      const keyMap = valuesMap.get(key)!;

      for (const v of values) {
        keyMap.set(v, (keyMap.get(v) ?? 0) + 1);
      }
    }
  }

  // Compute min/max from full dataset so slider ranges stay stable
  const minMaxMap = new Map<string, { min: number; max: number }>();
  for (const row of allData) {
    for (const key of filterableKeys) {
      const rawValue = row[key];
      if (rawValue === undefined || rawValue === null) continue;
      const numVal = Number(rawValue);
      if (isNaN(numVal)) continue;

      const existing = minMaxMap.get(key);
      if (existing) {
        if (numVal < existing.min) existing.min = numVal;
        if (numVal > existing.max) existing.max = numVal;
      } else {
        minMaxMap.set(key, { min: numVal, max: numVal });
      }
    }
  }

  const facets: Record<string, FacetMetadataSchema> = {};

  for (const [key, valueMap] of valuesMap.entries()) {
    const rows: { value: string | number | boolean; total: number }[] = [];
    const isBoolean = booleanKeys.has(key);

    for (const [value, total] of valueMap.entries()) {
      if (isBoolean) {
        rows.push({ value: value === "true", total });
      } else {
        const numVal = Number(value);
        if (!isNaN(numVal) && value !== "") {
          rows.push({ value: numVal, total });
        } else {
          rows.push({ value, total });
        }
      }
    }

    const fullRange = minMaxMap.get(key);

    facets[key] = {
      rows,
      total: rows.reduce((sum, r) => sum + r.total, 0),
      min: fullRange?.min,
      max: fullRange?.max,
    };
  }

  return facets;
}

/**
 * Slice data by offset/size for offset-based pagination.
 */
export function splitGenericData(
  data: Record<string, unknown>[],
  offset: number,
  size: number,
): Record<string, unknown>[] {
  return data.slice(offset, offset + size);
}

/**
 * Convert SchemaJSON to TableSchemaDefinition.
 */
export function schemaJsonToDefinition(
  schemaJson: SchemaJSON,
): TableSchemaDefinition {
  return createTableSchema.fromJSON(schemaJson).definition;
}

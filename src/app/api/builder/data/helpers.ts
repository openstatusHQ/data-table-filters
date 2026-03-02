import type { FacetMetadataSchema } from "@/app/infinite/schema";
import { createTableSchema } from "@/lib/table-schema";
import type { SchemaJSON, TableSchemaDefinition } from "@/lib/table-schema";

/**
 * Schema-aware filtering for generic builder data.
 *
 * Uses the table schema definition to determine how each filter should be applied:
 * - slider → range check (array of two numbers: [min, max])
 * - checkbox → inclusion check (array of values)
 * - input → substring match (string) or exact match (number)
 * - timerange → date range check (array of two date strings)
 */
export function filterGenericData(
  data: Record<string, unknown>[],
  filters: Record<string, unknown>,
  schema: TableSchemaDefinition,
): Record<string, unknown>[] {
  const activeFilters = Object.entries(filters).filter(([, value]) => {
    if (value === undefined || value === null) return false;
    if (Array.isArray(value) && value.length === 0) return false;
    if (typeof value === "string" && value === "") return false;
    return true;
  });

  if (activeFilters.length === 0) return data;

  return data.filter((row) => {
    for (const [key, filterValue] of activeFilters) {
      const colBuilder = schema[key];
      if (!colBuilder) continue;

      const filterConfig = colBuilder._config.filter;
      if (!filterConfig) continue;

      const cellValue = row[key];

      switch (filterConfig.type) {
        case "slider": {
          if (!Array.isArray(filterValue) || filterValue.length !== 2) continue;
          const [min, max] = filterValue as [number, number];
          const numValue = Number(cellValue);
          if (isNaN(numValue) || numValue < min || numValue > max) return false;
          break;
        }
        case "checkbox": {
          if (!Array.isArray(filterValue) || filterValue.length === 0) continue;
          // Handle array column values (e.g., regions)
          if (Array.isArray(cellValue)) {
            const hasMatch = cellValue.some((v) =>
              filterValue.includes(typeof v === "string" ? v : String(v)),
            );
            if (!hasMatch) return false;
          } else {
            const cellStr =
              typeof cellValue === "string" ? cellValue : String(cellValue);
            if (!filterValue.includes(cellStr)) return false;
          }
          break;
        }
        case "input": {
          if (typeof filterValue === "string" && filterValue !== "") {
            const cellStr = String(cellValue ?? "").toLowerCase();
            if (!cellStr.includes(filterValue.toLowerCase())) return false;
          } else if (typeof filterValue === "number") {
            if (Number(cellValue) !== filterValue) return false;
          }
          break;
        }
        case "timerange": {
          if (!Array.isArray(filterValue) || filterValue.length < 1) continue;
          const cellDate =
            cellValue instanceof Date ? cellValue : new Date(String(cellValue));
          if (isNaN(cellDate.getTime())) return false;
          const dates = filterValue.map((d) =>
            d instanceof Date ? d : new Date(String(d)),
          );
          if (dates.length === 1) {
            // Same day check
            if (cellDate.toDateString() !== dates[0].toDateString())
              return false;
          } else if (dates.length === 2) {
            if (
              cellDate.getTime() < dates[0].getTime() ||
              cellDate.getTime() > dates[1].getTime()
            )
              return false;
          }
          break;
        }
      }
    }
    return true;
  });
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
 * Compute facets (value counts + min/max) from data for all filterable columns.
 */
export function getGenericFacets(
  data: Record<string, unknown>[],
  schema: TableSchemaDefinition,
): Record<string, FacetMetadataSchema> {
  const filterableKeys = Object.entries(schema)
    .filter(([, builder]) => builder._config.filter !== null)
    .map(([key]) => key);

  const valuesMap = new Map<string, Map<string, number>>();

  for (const row of data) {
    for (const key of filterableKeys) {
      const rawValue = row[key];
      if (rawValue === undefined || rawValue === null) continue;

      // Convert array values to individual strings
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

  const facets: Record<string, FacetMetadataSchema> = {};

  for (const [key, valueMap] of valuesMap.entries()) {
    let min: number | undefined;
    let max: number | undefined;
    const rows: { value: string | number; total: number }[] = [];

    for (const [value, total] of valueMap.entries()) {
      const numVal = Number(value);
      if (!isNaN(numVal) && value !== "") {
        if (min === undefined || numVal < min) min = numVal;
        if (max === undefined || numVal > max) max = numVal;
        rows.push({ value: numVal, total });
      } else {
        rows.push({ value, total });
      }
    }

    facets[key] = {
      rows,
      total: rows.reduce((sum, r) => sum + r.total, 0),
      min,
      max,
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

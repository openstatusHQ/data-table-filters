import type { FacetMetadataSchema } from "@dtf/registry/lib/data-table/types";
import { and, count, max, min, sql, type SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import type { ColumnMapping, DrizzleDB } from "./types";

/**
 * Compute faceted counts for filter fields via SQL.
 *
 * For each key:
 * - Slider fields: SELECT MIN(col), MAX(col), COUNT(*)
 * - Array columns: unnest + GROUP BY for unique values
 * - Standard columns: GROUP BY for unique values with counts
 *
 * All facet queries run in parallel via Promise.all.
 */
export async function computeFacets(
  db: DrizzleDB,
  table: PgTable,
  mapping: ColumnMapping,
  baseConditions: SQL[],
  facetKeys: string[],
  options?: {
    /** Keys that should return min/max instead of grouped values */
    sliderKeys?: string[];
  },
): Promise<Record<string, FacetMetadataSchema>> {
  const whereCondition =
    baseConditions.length > 0 ? and(...baseConditions) : undefined;
  const sliderKeys = options?.sliderKeys ?? [];

  const queries = facetKeys.map(async (key) => {
    const column = mapping[key];
    if (!column) return [key, null] as const;

    if (sliderKeys.includes(key)) {
      const result = await db
        .select({
          min: min(column),
          max: max(column),
          total: count(),
        })
        .from(table)
        .where(whereCondition);

      const row = result[0];

      return [
        key,
        {
          rows: [],
          total: Number(row?.total ?? 0),
          min: row?.min != null ? Number(row.min) : undefined,
          max: row?.max != null ? Number(row.max) : undefined,
        } satisfies FacetMetadataSchema,
      ] as const;
    }

    // Array columns: unnest + GROUP BY
    if (column.dataType === "array") {
      const raw = await db.execute(
        sql`SELECT val as value, COUNT(*)::int as total
            FROM (
              SELECT unnest(${column}) as val
              FROM ${table}
              ${whereCondition ? sql`WHERE ${whereCondition}` : sql``}
            ) sub
            GROUP BY val
            ORDER BY total DESC`,
      );
      const result: { value: string; total: number }[] = Array.isArray(raw)
        ? raw
        : (raw as { rows: { value: string; total: number }[] }).rows;

      const total = result.reduce((sum, r) => sum + Number(r.total), 0);

      return [
        key,
        {
          rows: result.map((r) => ({
            value: r.value,
            total: Number(r.total),
          })),
          total,
        } satisfies FacetMetadataSchema,
      ] as const;
    }

    // Standard column: GROUP BY
    const raw = await db.execute(
      sql`SELECT ${column} as value, COUNT(*)::int as total
          FROM ${table}
          ${whereCondition ? sql`WHERE ${whereCondition}` : sql``}
          GROUP BY ${column}
          ORDER BY total DESC`,
    );
    const result: { value: string | number | boolean; total: number }[] =
      Array.isArray(raw)
        ? raw
        : (
            raw as {
              rows: { value: string | number | boolean; total: number }[];
            }
          ).rows;

    const total = result.reduce((sum, r) => sum + Number(r.total), 0);

    let minVal: number | undefined;
    let maxVal: number | undefined;
    if (result.length > 0 && typeof result[0].value === "number") {
      minVal = Math.min(...result.map((r) => Number(r.value)));
      maxVal = Math.max(...result.map((r) => Number(r.value)));
    }

    return [
      key,
      {
        rows: result.map((r) => ({
          value: r.value,
          total: Number(r.total),
        })),
        total,
        min: minVal,
        max: maxVal,
      } satisfies FacetMetadataSchema,
    ] as const;
  });

  const results = await Promise.all(queries);
  return Object.fromEntries(results.filter(([, v]) => v !== null));
}

import type { FacetMetadataSchema } from "@dtf/registry/lib/data-table/types";
import {
  resolveColumns,
  type TableSchemaDefinition,
} from "@dtf/registry/lib/table-schema";
import { and, count, eq, sql, type SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { computeFacets } from "./facets";
import { buildWhereConditions } from "./filters";
import { buildCursorPagination } from "./pagination";
import { buildOrderBy } from "./sorting";
import type { ColumnMapping, DrizzleDB, SortDescriptor } from "./types";

/**
 * Derive slider, facet, and date keys from a tableSchema definition.
 * Reads each column's descriptor filter type so no manual key lists are needed.
 */
function deriveKeys(schema: TableSchemaDefinition) {
  const sliderKeys: string[] = [];
  const facetKeys: string[] = [];
  const dateKeys: string[] = [];

  for (const { key, filter } of resolveColumns(schema)) {
    if (!filter) continue;
    if (filter.type === "slider") {
      sliderKeys.push(key);
      facetKeys.push(key);
    }
    if (filter.type === "checkbox") facetKeys.push(key);
    if (filter.type === "input") facetKeys.push(key);
    if (filter.type === "timerange") dateKeys.push(key);
  }

  return { sliderKeys, facetKeys, dateKeys };
}

type DrizzleHandlerKeys = {
  sliderKeys: string[];
  facetKeys: string[];
  dateKeys: string[];
};

type DrizzleHandlerConfigBase = {
  db: DrizzleDB;
  table: PgTable;
  columnMapping: ColumnMapping;
  cursorColumn: string;
  defaultSize?: number;
};

/**
 * Config with explicit key lists — use when `tableSchema` is in a
 * `"use client"` file and cannot be imported on the server.
 */
export type DrizzleHandlerConfigWithKeys = DrizzleHandlerConfigBase &
  DrizzleHandlerKeys;

/**
 * Config with `tableSchema.definition` — slider/facet/date keys are
 * derived automatically from each column's descriptor filter type.
 */
export type DrizzleHandlerConfigWithSchema = DrizzleHandlerConfigBase & {
  schema: TableSchemaDefinition;
};

export type DrizzleHandlerConfig =
  | DrizzleHandlerConfigWithKeys
  | DrizzleHandlerConfigWithSchema;

export type DrizzleHandlerResult<TRow = Record<string, unknown>> = {
  data: TRow[];
  facets: Record<string, FacetMetadataSchema>;
  totalRowCount: number;
  filterRowCount: number;
  nextCursor: number | null;
  prevCursor: number | null;
  /** The combined WHERE conditions (all three passes). Useful for chart queries. */
  allConditions: SQL[];
};

function resolveKeys(config: DrizzleHandlerConfig): DrizzleHandlerKeys {
  if ("schema" in config) {
    return deriveKeys(config.schema);
  }
  return {
    sliderKeys: config.sliderKeys,
    facetKeys: config.facetKeys,
    dateKeys: config.dateKeys,
  };
}

/**
 * Create a high-level query handler that encapsulates the three-pass filtering
 * strategy, faceted search, counts, and cursor pagination.
 *
 * Chart data and percentiles are intentionally excluded — handle them in user-land.
 *
 * @example
 * ```ts
 * // Option 1: Derive keys from tableSchema (when importable)
 * const handler = createDrizzleHandler({
 *   db,
 *   table: logs,
 *   schema: tableSchema.definition,
 *   columnMapping,
 *   cursorColumn: "date",
 * });
 *
 * // Option 2: Explicit keys (when tableSchema is "use client")
 * const handler = createDrizzleHandler({
 *   db,
 *   table: logs,
 *   columnMapping,
 *   cursorColumn: "date",
 *   sliderKeys: ["latency", "timing.dns", ...],
 *   facetKeys: ["level", "method", "latency", ...],
 *   dateKeys: ["date"],
 * });
 *
 * const result = await handler.execute(search);
 * ```
 */
export function createDrizzleHandler(config: DrizzleHandlerConfig) {
  const { db, table, columnMapping, cursorColumn, defaultSize = 40 } = config;
  const { sliderKeys, facetKeys, dateKeys } = resolveKeys(config);

  const cursorCol = columnMapping[cursorColumn];
  if (!cursorCol) {
    throw new Error(
      `cursorColumn "${cursorColumn}" not found in columnMapping`,
    );
  }

  return {
    /** Derived keys (exposed for advanced use cases) */
    sliderKeys,
    facetKeys,
    dateKeys,

    async execute(
      search: Record<string, unknown>,
    ): Promise<DrizzleHandlerResult> {
      const size = typeof search.size === "number" ? search.size : defaultSize;
      const sort = (search.sort as SortDescriptor) ?? null;
      const cursor = (search.cursor as Date | number | null) ?? null;
      const direction = (search.direction as "prev" | "next") ?? "next";

      // --- Three-pass filtering strategy ---

      // Pass 1: Date range conditions only
      const dateFilters = Object.fromEntries(
        Object.entries(search).filter(([key]) => dateKeys.includes(key)),
      );
      const dateConditions = buildWhereConditions(columnMapping, dateFilters);

      // Pass 2: Date + non-slider filters (for slider facet bounds)
      const nonSliderFilters = Object.fromEntries(
        Object.entries(search).filter(
          ([key]) => !sliderKeys.includes(key) && !dateKeys.includes(key),
        ),
      );
      const nonSliderConditions = buildWhereConditions(
        columnMapping,
        nonSliderFilters,
      );
      const pass2Conditions = [...dateConditions, ...nonSliderConditions];

      // Pass 3: All conditions including sliders
      const sliderFilters = Object.fromEntries(
        Object.entries(search).filter(([key]) => sliderKeys.includes(key)),
      );
      const sliderConditions = buildWhereConditions(
        columnMapping,
        sliderFilters,
      );
      const allConditions = [...pass2Conditions, ...sliderConditions];

      // --- Facets (parallel) ---
      const [sliderFacets, otherFacets] = await Promise.all([
        computeFacets(db, table, columnMapping, pass2Conditions, sliderKeys, {
          sliderKeys,
        }),
        computeFacets(
          db,
          table,
          columnMapping,
          allConditions,
          facetKeys.filter((k) => !sliderKeys.includes(k)),
        ),
      ]);

      const facets = { ...sliderFacets, ...otherFacets };

      // --- Counts (parallel) ---
      const allWhere =
        allConditions.length > 0 ? and(...allConditions) : undefined;

      const [totalResult, filterResult] = await Promise.all([
        db.select({ total: count() }).from(table),
        db.select({ total: count() }).from(table).where(allWhere),
      ]);

      const totalRowCount = totalResult[0]?.total ?? 0;
      const filterRowCount = filterResult[0]?.total ?? 0;

      // --- Sort + Cursor Pagination ---
      const orderBy = buildOrderBy(columnMapping, sort);

      const {
        cursorCondition,
        orderBy: cursorOrderBy,
        needsReverse,
      } = buildCursorPagination({
        cursor,
        direction,
        size,
        cursorColumn: cursorCol,
      });

      const dataConditions = cursorCondition
        ? [...allConditions, cursorCondition]
        : allConditions;

      const dataWhere =
        dataConditions.length > 0 ? and(...dataConditions) : undefined;

      const orderClauses = orderBy
        ? sql`${cursorOrderBy}, ${orderBy}`
        : cursorOrderBy;

      // One extra row reveals whether the page boundary splits a group of
      // rows sharing the same cursor value.
      const rows = await db
        .select()
        .from(table)
        .where(dataWhere)
        .orderBy(orderClauses)
        .limit(size + 1);

      const getCursorValue = (row: Record<string, unknown>): number | null => {
        if (!row) return null;
        const val = row[cursorCol.name];
        if (val instanceof Date) return val.getTime();
        if (typeof val === "number") return val;
        return null;
      };

      // --- Page boundary must fall between cursor values ---
      //
      // The next page is fetched with a strict `<` (or `>`) predicate on the
      // cursor column, so any row sharing the boundary value that did not fit
      // on this page would never be returned by any page. Rather than split a
      // group of tied rows, end the page before it and let the group start the
      // next one.
      let page = rows;

      const boundaryValue =
        rows.length > size ? getCursorValue(rows[size]) : null;

      // A cursor column that yields neither a Date nor a number cannot be
      // serialized into a cursor at all, so leave those tables untouched.
      if (boundaryValue !== null) {
        const overflowRow = rows[size];

        page = rows.slice(0, size);
        while (
          page.length > 0 &&
          getCursorValue(page[page.length - 1]) === boundaryValue
        ) {
          page.pop();
        }

        // Degenerate case: a single cursor value spans the whole page, so
        // there is no boundary to retreat to. Return the entire tied group —
        // overflowing `size` is the only way to make progress without
        // dropping rows.
        if (page.length === 0) {
          page = await db
            .select()
            .from(table)
            .where(
              and(
                ...dataConditions,
                eq(cursorCol, overflowRow[cursorCol.name]),
              ),
            )
            .orderBy(orderClauses);
        }
      }

      if (needsReverse) {
        page.reverse();
      }

      // --- Cursors ---
      const lastRow = page[page.length - 1];
      const firstRow = page[0];

      const nextCursor = lastRow ? getCursorValue(lastRow) : null;
      const prevCursor = firstRow
        ? getCursorValue(firstRow)
        : new Date().getTime();

      return {
        data: page,
        facets,
        totalRowCount,
        filterRowCount,
        nextCursor,
        prevCursor,
        allConditions,
      };
    },
  };
}

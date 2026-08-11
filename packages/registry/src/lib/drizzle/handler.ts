import type { FacetMetadataSchema } from "@dtf/registry/lib/data-table/types";
import type { Filters } from "@dtf/registry/lib/filters";
import { and, count, eq, sql, type SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { computeFacets } from "./facets";
import { buildWhereConditions } from "./filters";
import { buildCursorPagination } from "./pagination";
import { buildOrderBy } from "./sorting";
import type { ColumnMapping, DrizzleDB, SortDescriptor } from "./types";

/**
 * Derive slider, facet, and date keys from declared filter semantics.
 *
 * These are pass groupings for the three-pass strategy, not semantics — the
 * semantics live in `Filters` and are the same everywhere.
 */
function deriveKeys(filters: Filters) {
  const sliderKeys: string[] = [];
  const facetKeys: string[] = [];
  const dateKeys: string[] = [];

  for (const { key, type } of filters.specs) {
    if (type === "slider") {
      sliderKeys.push(key);
      facetKeys.push(key);
    }
    if (type === "checkbox") facetKeys.push(key);
    if (type === "input") facetKeys.push(key);
    if (type === "timerange") dateKeys.push(key);
  }

  return { sliderKeys, facetKeys, dateKeys };
}

/**
 * One config shape.
 *
 * The old two-shape union existed because `tableSchema` lives in a
 * `"use client"` file and could not be imported on the server, so the server
 * had to be handed three untyped `string[]`s instead. `defineFilters` accepts
 * `SchemaJSON`, so the declaration now crosses that boundary as data and one
 * field carries the semantics.
 */
export type DrizzleHandlerConfig = {
  db: DrizzleDB;
  table: PgTable;
  /** Built with `defineFilters(tableSchema.definition | schemaJson | specs)`. */
  filters: Filters;
  columnMapping: ColumnMapping;
  cursorColumn: string;
  defaultSize?: number;
};

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

/**
 * Create a high-level query handler that encapsulates the three-pass filtering
 * strategy, faceted search, counts, and cursor pagination.
 *
 * Chart data and percentiles are intentionally excluded — handle them in user-land.
 *
 * @example
 * ```ts
 * // `tableSchema` is importable (not a "use client" file)
 * const handler = createDrizzleHandler({
 *   db,
 *   table: logs,
 *   filters: defineFilters(tableSchema.definition),
 *   columnMapping,
 *   cursorColumn: "date",
 * });
 *
 * // `tableSchema` is "use client" — the declaration crosses as data
 * const handler = createDrizzleHandler({
 *   db,
 *   table: logs,
 *   filters: defineFilters(schemaJson),
 *   columnMapping,
 *   cursorColumn: "date",
 * });
 *
 * const result = await handler.execute(search);
 * ```
 */
export function createDrizzleHandler(config: DrizzleHandlerConfig) {
  const {
    db,
    table,
    filters,
    columnMapping,
    cursorColumn,
    defaultSize = 40,
  } = config;
  const { sliderKeys, facetKeys, dateKeys } = deriveKeys(filters);

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
      const dateConditions = buildWhereConditions(
        filters,
        search,
        columnMapping,
        {
          only: dateKeys,
        },
      );

      // Pass 2: Date + non-slider filters (for slider facet bounds)
      const nonSliderConditions = buildWhereConditions(
        filters,
        search,
        columnMapping,
        { exclude: [...sliderKeys, ...dateKeys] },
      );
      const pass2Conditions = [...dateConditions, ...nonSliderConditions];

      // Pass 3: All conditions including sliders
      const sliderConditions = buildWhereConditions(
        filters,
        search,
        columnMapping,
        { only: sliderKeys },
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

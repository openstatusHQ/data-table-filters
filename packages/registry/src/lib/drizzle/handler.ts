import type { FacetMetadataSchema } from "@dtf/registry/lib/data-table/types";
import type { Filters } from "@dtf/registry/lib/filters";
import { and, count, eq, sql, type Column, type SQL } from "drizzle-orm";
import type {
  SelectedFields as PgSelectedFields,
  PgTable,
} from "drizzle-orm/pg-core";
import { computeFacets } from "./facets";
import { buildWhereConditions } from "./filters";
import { evaluateIntervalMs } from "./interval";
import { buildCursorPagination } from "./pagination";
import { buildOrderBy } from "./sorting";
import type {
  ColumnMapping,
  DrizzleDB,
  DrizzleQueryScope,
  SortDescriptor,
} from "./types";

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
 * The date range the user asked for, if any.
 *
 * Read through `filters.plan` rather than off the raw search values, so the
 * single-date and reversed-bounds cases are normalized the same way they are
 * for the WHERE clause.
 */
function resolveExplicitRange(
  filters: Filters,
  search: Record<string, unknown>,
  dateKeys: string[],
): { from: Date; to: Date } | null {
  for (const op of filters.plan(search, { only: dateKeys })) {
    if (op.op === "dateRange") return { from: op.from, to: op.to };
  }
  return null;
}

/** MIN/MAX over the filtered set, for when no explicit range was given. */
async function discoverRange(
  db: DrizzleDB,
  table: PgTable,
  column: Column,
  where: SQL | undefined,
): Promise<{ from: Date; to: Date } | null> {
  const result = await db
    .select({
      from: sql<Date | null>`MIN(${column})`,
      to: sql<Date | null>`MAX(${column})`,
    })
    .from(table)
    .where(where);

  const row = result[0];
  if (!row?.from || !row?.to) return null;
  const from = new Date(row.from);
  const to = new Date(row.to);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  return { from, to };
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
  /**
   * The schema key rows are paged by. A `Date` or numeric column, since the
   * cursor is serialized as a number.
   *
   * `scope.range` and `scope.bucketMs` are read off THIS column when no
   * explicit date filter is set, so a non-time cursor (an auto-increment id,
   * say) still paginates correctly but hands aggregate callers a range built
   * from `new Date(id)`. Page by your time column unless you have no use for
   * `scope.range`.
   */
  cursorColumn: string;
  defaultSize?: number;
  /**
   * Extra projected fields merged into each row — columns that are never
   * filtered or sorted, joins, computed SQL.
   *
   * `columnMapping` already declares the schema-key ↔ Drizzle-column
   * relationship, so it doubles as the projection. Anything the wire contract
   * needs but the filters do not goes here.
   */
  select?: Record<string, Column | SQL.Aliased>;
};

export type DrizzleHandlerResult<TRow = Record<string, unknown>> = {
  /** Keyed by SCHEMA keys — `"timing.dns"`, never `timingDns`. */
  data: TRow[];
  facets: Record<string, FacetMetadataSchema>;
  totalRowCount: number;
  filterRowCount: number;
  nextCursor: number | null;
  prevCursor: number | null;
  /**
   * One typed handle for callers writing their own aggregate SQL.
   *
   * Replaces `allConditions: SQL[]`, which leaked just enough to make callers
   * re-derive the range, the bucket size, and the WHERE composition by hand —
   * with `db: any` at the boundary and no test at any level.
   */
  scope: DrizzleQueryScope;
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
    select: extraSelect,
  } = config;
  const { sliderKeys, facetKeys, dateKeys } = deriveKeys(filters);

  const cursorCol = columnMapping[cursorColumn];
  if (!cursorCol) {
    throw new Error(
      `cursorColumn "${cursorColumn}" not found in columnMapping`,
    );
  }

  // Fail loudly at construction, not silently at query time.
  //
  // `buildWhereConditions` and `buildOrderBy` both skip a key that is missing
  // from the mapping. `ColumnMapping` is `Record<string, Column>`, so a typo
  // was not a type error either — the filter just stopped filtering, with no
  // error, no warning, and no failing test.
  const unmapped = filters.specs
    .map((spec) => spec.key)
    .filter((key) => !columnMapping[key]);
  if (unmapped.length > 0) {
    throw new Error(
      `[createDrizzleHandler] These filterable columns are missing from columnMapping:\n` +
        unmapped.map((key) => `  - ${key}`).join("\n") +
        `\n\n  Fix: add them, e.g.\n` +
        `  columnMapping: {\n` +
        unmapped
          .map(
            (key) =>
              `    ${JSON.stringify(key)}: table.${key.replace(/[.\-_](\w)/g, (_, c) => c.toUpperCase())},`,
          )
          .join("\n") +
        `\n  }`,
    );
  }

  // Rows come back keyed by SCHEMA keys because the projection IS the mapping.
  // Callers used to hand-write the inverse of this — twice, and the two copies
  // had already drifted.
  // `ColumnMapping` is driver-agnostic (`Column`) by design, while `db.select`
  // wants pg's narrower `SelectedFields`. Every value here is a real pg column
  // or aliased SQL; narrowing `ColumnMapping` itself would make the public type
  // pg-specific for every consumer.
  const projection = {
    ...columnMapping,
    ...(extraSelect ?? {}),
  } as PgSelectedFields;

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

      const allWhereForScope =
        allConditions.length > 0 ? and(...allConditions) : undefined;
      const pass2Where =
        pass2Conditions.length > 0 ? and(...pass2Conditions) : undefined;

      // Resolve the time range once, here, rather than leaving every caller
      // writing custom aggregate SQL to rediscover it. An explicit date filter
      // wins; otherwise it comes from MIN/MAX over the filtered set.
      const explicitRange = resolveExplicitRange(filters, search, dateKeys);

      // --- Facets + range (parallel) ---
      const [sliderFacets, otherFacets, discoveredRange] = await Promise.all([
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
        // Skipped entirely when the range is already known, so the common
        // "user picked a date range" path costs nothing extra.
        explicitRange
          ? Promise.resolve(null)
          : discoverRange(db, table, cursorCol, allWhereForScope),
      ]);

      const range = explicitRange ?? discoveredRange;

      const facets = { ...sliderFacets, ...otherFacets };

      // --- Counts (parallel) ---
      const allWhere = allWhereForScope;

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
        .select(projection)
        .from(table)
        .where(dataWhere)
        .orderBy(orderClauses)
        .limit(size + 1);

      // Read by SCHEMA key. This used to read `row[cursorCol.name]` — the SQL
      // column name. They coincide for `date`; for any cursor column whose DB
      // name differs from its key (`timing_dns` vs `"timing.dns"`) the lookup
      // was `undefined`, so `boundaryValue` was null, the whole tie-snapping
      // block was skipped, and `nextCursor` came back null — silently ending
      // pagination after one page.
      const getCursorValue = (row: Record<string, unknown>): number | null => {
        if (!row) return null;
        const val = row[cursorColumn];
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
            .select(projection)
            .from(table)
            .where(
              and(...dataConditions, eq(cursorCol, overflowRow[cursorColumn])),
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

      const scope: DrizzleQueryScope = {
        db,
        table,
        columns: columnMapping,
        where: allWhereForScope,
        whereWithoutSliders: pass2Where,
        range,
        bucketMs: evaluateIntervalMs(
          range ? range.to.getTime() - range.from.getTime() : 0,
        ),
      };

      return {
        data: page,
        facets,
        totalRowCount,
        filterRowCount,
        nextCursor,
        prevCursor,
        scope,
      };
    },
  };
}

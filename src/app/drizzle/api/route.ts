import { db } from "@/db/drizzle";
import { logs } from "@/db/drizzle/schema";
import {
  buildCursorPagination,
  buildOrderBy,
  buildWhereConditions,
  computeFacets,
} from "@/lib/drizzle";
import { calculateSpecificPercentile } from "@/lib/request/percentile";
import { and, count, sql } from "drizzle-orm";
import { NextRequest } from "next/server";
import SuperJSON from "superjson";
import { columnMapping } from "../column-mapping";
import type { InfiniteQueryResponse, LogsMeta } from "../query-options";
import type { ColumnSchema } from "../schema";
import { searchParamsCache } from "../search-params";

export const dynamic = "force-dynamic";

const sliderKeys = [
  "latency",
  "timing.dns",
  "timing.connection",
  "timing.tls",
  "timing.ttfb",
  "timing.transfer",
];

const facetKeys = [
  "level",
  "method",
  "status",
  "regions",
  "host",
  "pathname",
  ...sliderKeys,
];

export async function GET(req: NextRequest): Promise<Response> {
  const _search: Map<string, string> = new Map();
  req.nextUrl.searchParams.forEach((value, key) => _search.set(key, value));
  const search = searchParamsCache.parse(Object.fromEntries(_search));

  // --- Three-pass filtering strategy ---

  // Pass 1: Date range conditions
  const dateConditions = buildWhereConditions(columnMapping, {
    date: search.date,
  });

  // Pass 2: Non-slider filters (for slider facet bounds)
  const nonSliderFilters = Object.fromEntries(
    Object.entries(search).filter(
      ([key]) => !sliderKeys.includes(key) && key !== "date",
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
  const sliderConditions = buildWhereConditions(columnMapping, sliderFilters);
  const allConditions = [...pass2Conditions, ...sliderConditions];

  // --- Facets ---
  const [sliderFacets, otherFacets] = await Promise.all([
    // Slider facets use pass2 (so slider bounds don't collapse)
    computeFacets(db, logs, columnMapping, pass2Conditions, sliderKeys, {
      sliderKeys,
    }),
    // Other facets use all conditions
    computeFacets(
      db,
      logs,
      columnMapping,
      allConditions,
      facetKeys.filter((k) => !sliderKeys.includes(k)),
    ),
  ]);

  const facets = { ...sliderFacets, ...otherFacets };

  // --- Counts ---
  const allWhere = allConditions.length > 0 ? and(...allConditions) : undefined;

  const [totalResult, filterResult] = await Promise.all([
    db.select({ total: count() }).from(logs),
    db.select({ total: count() }).from(logs).where(allWhere),
  ]);

  const totalRowCount = totalResult[0]?.total ?? 0;
  const filterRowCount = filterResult[0]?.total ?? 0;

  // --- Sort + Cursor Pagination ---
  const orderBy = buildOrderBy(columnMapping, search.sort ?? null);

  const {
    cursorCondition,
    orderBy: cursorOrderBy,
    needsReverse,
  } = buildCursorPagination({
    cursor: search.cursor ?? null,
    direction: search.direction ?? "next",
    size: search.size ?? 40,
    cursorColumn: logs.date,
  });

  const dataConditions = cursorCondition
    ? [...allConditions, cursorCondition]
    : allConditions;

  const dataWhere =
    dataConditions.length > 0 ? and(...dataConditions) : undefined;

  const size = search.size ?? 40;

  // Use cursor ordering for pagination, with sort as secondary
  const orderClauses = orderBy
    ? sql`${cursorOrderBy}, ${orderBy}`
    : cursorOrderBy;

  const rows = await db
    .select()
    .from(logs)
    .where(dataWhere)
    .orderBy(orderClauses)
    .limit(size);

  // Reverse if paginating backwards
  if (needsReverse) {
    rows.reverse();
  }

  // Map DB rows to ColumnSchema shape
  const data: ColumnSchema[] = rows.map((row) => ({
    uuid: row.uuid,
    level: row.level,
    method: row.method,
    host: row.host,
    pathname: row.pathname,
    status: row.status,
    latency: row.latency,
    regions: row.regions as ColumnSchema["regions"],
    date: row.date,
    headers: row.headers,
    message: row.message ?? undefined,
    "timing.dns": row.timingDns,
    "timing.connection": row.timingConnection,
    "timing.tls": row.timingTls,
    "timing.ttfb": row.timingTtfb,
    "timing.transfer": row.timingTransfer,
  }));

  // --- Percentiles ---
  const latencies = data.map((d) => d.latency);
  const currentPercentiles = {
    50: calculateSpecificPercentile(latencies, 50),
    75: calculateSpecificPercentile(latencies, 75),
    90: calculateSpecificPercentile(latencies, 90),
    95: calculateSpecificPercentile(latencies, 95),
    99: calculateSpecificPercentile(latencies, 99),
  };

  // --- Chart data via SQL ---
  const chartData = await getChartData(db, logs, allConditions, search.date);

  // --- Cursors ---
  const nextCursor =
    data.length > 0 ? data[data.length - 1].date.getTime() : null;
  const prevCursor =
    data.length > 0 ? data[0].date.getTime() : new Date().getTime();

  return Response.json(
    SuperJSON.stringify({
      data,
      meta: {
        totalRowCount,
        filterRowCount,
        chartData,
        facets,
        metadata: { currentPercentiles },
      },
      prevCursor,
      nextCursor,
    } satisfies InfiniteQueryResponse<ColumnSchema[], LogsMeta>),
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getChartData(
  db: any,
  table: typeof logs,
  conditions: import("drizzle-orm").SQL[],
  dates: (Date | null)[] | null | undefined,
) {
  const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

  // Determine date range for bucketing
  let minDate: Date | undefined;
  let maxDate: Date | undefined;

  const validDates = dates?.filter((d): d is Date => d !== null);
  if (validDates && validDates.length >= 1) {
    minDate = validDates[0];
    maxDate = validDates.length >= 2 ? validDates[1] : undefined;
  }

  if (!minDate) {
    // Default: use the range from the filtered data
    const rangeResult = await db
      .select({
        minDate: sql<Date>`MIN(${table.date})`,
        maxDate: sql<Date>`MAX(${table.date})`,
      })
      .from(table)
      .where(whereCondition);

    const row = rangeResult[0];
    if (!row?.minDate || !row?.maxDate) return [];
    minDate = new Date(row.minDate);
    maxDate = new Date(row.maxDate);
  }

  if (!maxDate) {
    const { addDays } = await import("date-fns");
    maxDate = addDays(minDate, 1);
  }

  const durationMs = maxDate.getTime() - minDate.getTime();
  const intervalMs = evaluateIntervalMs(durationMs);
  const intervalSeconds = Math.max(1, Math.floor(intervalMs / 1000));

  const result: {
    bucket: Date;
    success: number;
    warning: number;
    error: number;
  }[] = await db.execute(
    sql`SELECT
        date_bin(${intervalSeconds + " seconds"}::interval, ${table.date}, ${minDate}) as bucket,
        COUNT(*) FILTER (WHERE ${table.level} = 'success')::int as success,
        COUNT(*) FILTER (WHERE ${table.level} = 'warning')::int as warning,
        COUNT(*) FILTER (WHERE ${table.level} = 'error')::int as error
      FROM ${table}
      ${whereCondition ? sql`WHERE ${whereCondition}` : sql``}
      GROUP BY bucket
      ORDER BY bucket ASC`,
  );

  return result.map((r) => ({
    timestamp: new Date(r.bucket).getTime(),
    success: Number(r.success),
    warning: Number(r.warning),
    error: Number(r.error),
  }));
}

function evaluateIntervalMs(durationMs: number): number {
  const durationMinutes = durationMs / 60000;

  const intervals = [
    { threshold: 1, interval: 1000 },
    { threshold: 5, interval: 5000 },
    { threshold: 10, interval: 10000 },
    { threshold: 30, interval: 30000 },
    { threshold: 60, interval: 60000 },
    { threshold: 120, interval: 120000 },
    { threshold: 240, interval: 240000 },
    { threshold: 480, interval: 480000 },
    { threshold: 1440, interval: 1440000 },
    { threshold: 2880, interval: 2880000 },
    { threshold: 5760, interval: 5760000 },
    { threshold: 11520, interval: 11520000 },
    { threshold: 23040, interval: 23040000 },
  ];

  for (const { threshold, interval } of intervals) {
    if (durationMinutes < threshold) return interval;
  }

  return 46080000;
}

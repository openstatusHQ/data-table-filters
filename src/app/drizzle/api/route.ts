import { db } from "@/db/drizzle";
import { logs } from "@/db/drizzle/schema";
import { createDrizzleHandler } from "@/lib/drizzle";
import {
  calculatePercentile,
  calculateSpecificPercentile,
} from "@/lib/request/percentile";
import { and, sql } from "drizzle-orm";
import { NextRequest } from "next/server";
import SuperJSON from "superjson";
import { columnMapping } from "../column-mapping";
import type { InfiniteQueryResponse, LogsMeta } from "../query-options";
import type { ColumnSchema } from "../schema";
import { searchParamsCache } from "../search-params";
import { tableSchema } from "../table-schema";

export const dynamic = "force-dynamic";

const handler = createDrizzleHandler({
  db,
  table: logs,
  schema: tableSchema.definition,
  columnMapping,
  cursorColumn: "date",
  defaultSize: 40,
});

export async function GET(req: NextRequest): Promise<Response> {
  try {
    const _search: Map<string, string> = new Map();
    req.nextUrl.searchParams.forEach((value, key) => _search.set(key, value));
    const search = searchParamsCache.parse(Object.fromEntries(_search));

    const result = await handler.execute(search as Record<string, unknown>);

    // Map DB rows to ColumnSchema shape
    type LogRow = typeof logs.$inferSelect;
    const data: ColumnSchema[] = result.data.map((row) => {
      const r = row as LogRow;
      return {
        uuid: r.uuid,
        level: r.level,
        method: r.method,
        host: r.host,
        pathname: r.pathname,
        status: r.status,
        latency: r.latency,
        regions: r.regions as ColumnSchema["regions"],
        date: r.date,
        headers: r.headers,
        message: r.message ?? undefined,
        "timing.dns": r.timingDns,
        "timing.connection": r.timingConnection,
        "timing.tls": r.timingTls,
        "timing.ttfb": r.timingTtfb,
        "timing.transfer": r.timingTransfer,
      };
    });

    // --- Per-row percentile ---
    const latencies = data.map((d) => d.latency);
    for (const row of data) {
      row.percentile = calculatePercentile(latencies, row.latency);
    }

    // --- Percentiles ---
    const currentPercentiles = {
      50: calculateSpecificPercentile(latencies, 50),
      75: calculateSpecificPercentile(latencies, 75),
      90: calculateSpecificPercentile(latencies, 90),
      95: calculateSpecificPercentile(latencies, 95),
      99: calculateSpecificPercentile(latencies, 99),
    };

    // --- Chart data via SQL ---
    const chartData = await getChartData(
      db,
      logs,
      result.allConditions,
      search.date,
    );

    return Response.json(
      SuperJSON.stringify({
        data,
        meta: {
          totalRowCount: result.totalRowCount,
          filterRowCount: result.filterRowCount,
          chartData,
          facets: result.facets,
          metadata: { currentPercentiles },
        },
        prevCursor: result.prevCursor,
        nextCursor: result.nextCursor,
      } satisfies InfiniteQueryResponse<ColumnSchema[], LogsMeta>),
    );
  } catch (error) {
    console.error("[drizzle/api] GET failed:", error);
    return Response.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}

 
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

  type ChartRow = {
    bucket: Date;
    success: number;
    warning: number;
    error: number;
  };
  const raw = await db.execute(
    sql`SELECT
        date_bin(${intervalSeconds + " seconds"}::interval, ${table.date}, ${minDate.toISOString()}::timestamptz) as bucket,
        COUNT(*) FILTER (WHERE ${table.level} = 'success')::int as success,
        COUNT(*) FILTER (WHERE ${table.level} = 'warning')::int as warning,
        COUNT(*) FILTER (WHERE ${table.level} = 'error')::int as error
      FROM ${table}
      ${whereCondition ? sql`WHERE ${whereCondition}` : sql``}
      GROUP BY bucket
      ORDER BY bucket ASC`,
  );
  const result: ChartRow[] = Array.isArray(raw)
    ? raw
    : (raw as { rows: ChartRow[] }).rows;

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

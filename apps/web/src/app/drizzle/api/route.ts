import { db } from "@/db/drizzle";
import { logs } from "@/db/drizzle/schema";
import {
  calculatePercentile,
  calculateSpecificPercentile,
} from "@/lib/request/percentile";
import {
  createDrizzleHandler,
  type DrizzleQueryScope,
} from "@dtf/registry/lib/drizzle";
import { sql } from "drizzle-orm";
import { NextRequest } from "next/server";
import SuperJSON from "superjson";
import { columnMapping } from "../column-mapping";
import type { InfiniteQueryResponse, LogsMeta } from "../query-options";
import type { ColumnSchema } from "../schema";
import { searchParamsCache } from "../search-params";
import { actionHandler, demoActionsEnabled, filters } from "./actions";

export const dynamic = "force-dynamic";

const handler = createDrizzleHandler({
  db,
  table: logs,
  filters,
  columnMapping,
  cursorColumn: "date",
  defaultSize: 40,
  // Part of the wire contract but never filtered or sorted, so absent from
  // `columnMapping`. Rows come back keyed by schema keys either way.
  select: {
    headers: logs.headers,
    message: logs.message,
  },
});

export async function GET(req: NextRequest): Promise<Response> {
  try {
    const _search: Map<string, string> = new Map();
    req.nextUrl.searchParams.forEach((value, key) => _search.set(key, value));
    const search = searchParamsCache.parse(Object.fromEntries(_search));

    const result = await handler.execute(search as Record<string, unknown>);

    // No remap: the handler projects with `columnMapping`, so rows already
    // arrive keyed by schema keys ("timing.dns", not timingDns).
    const actionsEnabled = demoActionsEnabled();
    // --- Row actions: stamp each row with what can be done to it ---
    const data = (actionsEnabled
      ? actionHandler.annotate(result.data)
      : result.data) as unknown as ColumnSchema[];

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
    const chartData = await getChartData(result.scope);

    return Response.json(
      SuperJSON.stringify({
        data,
        meta: {
          totalRowCount: result.totalRowCount,
          filterRowCount: result.filterRowCount,
          chartData,
          facets: result.facets,
          ...(actionsEnabled ? { actions: actionHandler.descriptors } : {}),
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

/**
 * Bucketed level counts over the same filtered set the handler queried.
 *
 * Range resolution, the interval ladder, and WHERE composition all come from
 * `scope` — this used to re-derive all three, with `db: any` at the boundary
 * and no test at any level.
 */
async function getChartData(scope: DrizzleQueryScope) {
  const { range, bucketMs, where } = scope;
  if (!range) return [];

  const intervalSeconds = Math.max(1, Math.floor(bucketMs / 1000));

  type ChartRow = {
    bucket: Date;
    success: number;
    warning: number;
    error: number;
  };

  const raw = await scope.db.execute(
    sql`SELECT
        date_bin(${intervalSeconds + " seconds"}::interval, ${logs.date}, ${range.from.toISOString()}::timestamptz) as bucket,
        COUNT(*) FILTER (WHERE ${logs.level} = 'success')::int as success,
        COUNT(*) FILTER (WHERE ${logs.level} = 'warning')::int as warning,
        COUNT(*) FILTER (WHERE ${logs.level} = 'error')::int as error
      FROM ${logs}
      ${where ? sql`WHERE ${where}` : sql``}
      GROUP BY bucket
      ORDER BY bucket ASC`,
  );

  // node-postgres returns `{ rows }`; some drivers return the array directly.
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

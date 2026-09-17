// Not `chart.ts`: the block depends on shadcn's `chart` component, and the CLI
// rewrites any import whose last segment matches a ui item's name to the ui
// alias — `@/lib/data-table/chart` came out as `@/components/ui/chart`.
import { evaluateIntervalMs } from "./interval";
import type { BaseChartSchema } from "./types";

export type BucketChartDataOptions<TRow> = {
  /** The instant a row belongs to. */
  timestamp: (row: TRow) => Date | number;
  /** Which series a row counts towards — a log level, a status class. */
  series: (row: TRow) => string;
  /** Every series, so each bucket carries a zero for the ones with no rows. */
  keys: readonly string[];
  /**
   * The span to bucket, as a time-range filter value: two instants, or one
   * (read as that day). Omitted or empty, the rows' own extent is used.
   */
  range?: readonly (Date | null | undefined)[] | null;
  /** Bucket width. Omitted, the ladder in `evaluateIntervalMs` picks one. */
  intervalMs?: number;
};

/**
 * The span a chart covers: the range filter when one is set, else the oldest
 * and newest row. `null` when neither says anything.
 */
export function chartRange<TRow>(
  rows: readonly TRow[],
  timestamp: (row: TRow) => Date | number,
  range?: BucketChartDataOptions<TRow>["range"],
): [number, number] | null {
  const dates = (range ?? []).filter(
    (date): date is Date => date instanceof Date,
  );
  // One date is that whole local day — the same bounds the timerange filter
  // selects rows by, so the chart covers exactly the rows in the table.
  if (dates.length === 1) {
    return [startOfDay(dates[0]).getTime(), endOfDay(dates[0]).getTime()];
  }
  if (dates.length >= 2) {
    const a = dates[0].getTime();
    const b = dates[1].getTime();
    return [Math.min(a, b), Math.max(a, b)];
  }
  if (rows.length === 0) return null;

  let min = Infinity;
  let max = -Infinity;
  for (const row of rows) {
    const time = toTime(timestamp(row));
    if (time < min) min = time;
    if (time > max) max = time;
  }
  return [min, max];
}

/**
 * Rows → the `meta.chartData` the timeline chart draws: one point per bucket,
 * each carrying a count per series.
 *
 * The buckets start at the range's beginning and stop at the last whole
 * interval inside it, so a row past that edge is dropped rather than counted
 * in a bucket the chart does not draw. Same semantics as the Drizzle handler's
 * SQL aggregation, which is what makes the in-memory and database examples
 * interchangeable behind one client.
 */
export function bucketChartData<TRow>(
  rows: readonly TRow[],
  options: BucketChartDataOptions<TRow>,
): BaseChartSchema[] {
  const span = chartRange(rows, options.timestamp, options.range);
  if (!span) return [];

  const [start, end] = span;
  const duration = end - start;
  const interval = options.intervalMs ?? evaluateIntervalMs(duration);
  if (interval <= 0) return [];

  // At least one bucket: a span shorter than the interval — a single row, a
  // tight zoom — still has rows to show, and an empty array hides the chart.
  const steps = Math.max(1, Math.floor(duration / interval));
  const buckets: BaseChartSchema[] = Array.from({ length: steps }, (_, i) => {
    const bucket: BaseChartSchema = { timestamp: start + i * interval };
    for (const key of options.keys) bucket[key] = 0;
    return bucket;
  });

  for (const row of rows) {
    const offset = toTime(options.timestamp(row)) - start;
    if (offset < 0 || offset > duration) continue;
    const bucket = buckets[Math.floor(offset / interval)];
    if (!bucket) continue;
    const key = options.series(row);
    if (key in bucket) bucket[key] += 1;
  }

  return buckets;
}

function toTime(value: Date | number): number {
  return value instanceof Date ? value.getTime() : value;
}

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

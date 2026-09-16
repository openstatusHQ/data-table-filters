// Not `chart.ts`: the block depends on shadcn's `chart` component, and the CLI
// rewrites any import whose last segment matches a ui item's name to the ui
// alias — `@/lib/data-table/chart` came out as `@/components/ui/chart`.
import { evaluateIntervalMs } from "./interval";
import type { BaseChartSchema } from "./types";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

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
  if (dates.length === 1) {
    const start = dates[0].getTime();
    return [start, start + ONE_DAY_MS];
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

  const steps = Math.floor(duration / interval);
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

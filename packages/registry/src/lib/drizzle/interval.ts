/**
 * The bucket-size ladder for time-series aggregation.
 *
 * Thirteen rungs, from one second to 384 minutes (6.4 hours), plus a
 * fall-through at 768 minutes for anything longer. Given how long a range is,
 * this picks a bucket that yields a readable number of points.
 *
 * This lived inline in a demo route with no test at any level. It is exported
 * here so `DrizzleQueryScope.bucketMs` can be tested directly rather than
 * through a chart query.
 */
const INTERVALS: readonly { thresholdMinutes: number; intervalMs: number }[] = [
  { thresholdMinutes: 1, intervalMs: 1_000 }, // 1 second
  { thresholdMinutes: 5, intervalMs: 5_000 }, // 5 seconds
  { thresholdMinutes: 10, intervalMs: 10_000 }, // 10 seconds
  { thresholdMinutes: 30, intervalMs: 30_000 }, // 30 seconds
  { thresholdMinutes: 60, intervalMs: 60_000 }, // 1 minute
  { thresholdMinutes: 120, intervalMs: 120_000 }, // 2 minutes
  { thresholdMinutes: 240, intervalMs: 240_000 }, // 4 minutes
  { thresholdMinutes: 480, intervalMs: 480_000 }, // 8 minutes
  { thresholdMinutes: 1_440, intervalMs: 1_440_000 }, // 24 minutes
  { thresholdMinutes: 2_880, intervalMs: 2_880_000 }, // 48 minutes
  { thresholdMinutes: 5_760, intervalMs: 5_760_000 }, // 96 minutes
  { thresholdMinutes: 11_520, intervalMs: 11_520_000 }, // 192 minutes
  { thresholdMinutes: 23_040, intervalMs: 23_040_000 }, // 384 minutes
];

/** The bucket used for any range longer than the last threshold. */
const MAX_INTERVAL_MS = 46_080_000; // 768 minutes

/**
 * Pick a bucket size for a range of `durationMs`.
 *
 * Negative durations are treated as their absolute value, so callers do not
 * have to order the bounds first.
 */
export function evaluateIntervalMs(durationMs: number): number {
  if (!Number.isFinite(durationMs)) return MAX_INTERVAL_MS;
  const durationMinutes = Math.abs(durationMs) / 60_000;
  for (const { thresholdMinutes, intervalMs } of INTERVALS) {
    if (durationMinutes < thresholdMinutes) return intervalMs;
  }
  return MAX_INTERVAL_MS;
}

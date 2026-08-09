import type { BaseChartSchema } from "@dtf/registry/lib/data-table/types";
import { format, isSameDay } from "date-fns";

/**
 * Sums every numeric bucket value for the buckets falling inside the inclusive
 * `[from, to]` timestamp range.
 *
 * Stays generic over the bucket shape on purpose: `TimelineChart` is rendered
 * with different schemas across the demos (e.g. `success`/`warning`/`error` for
 * logs), so every key but `timestamp` is treated as a count.
 */
export function sumBucketRows<TChart extends BaseChartSchema>(
  data: TChart[],
  from: number,
  to: number,
): number {
  return Object.values(sumBucketValues(data, from, to)).reduce(
    (total, value) => total + value,
    0,
  );
}

/**
 * The same sum, kept per key, so the selection can break its total down the way
 * the tooltip does (`success`/`warning`/`error` for logs).
 *
 * Keys absent from every bucket in range are absent from the result - the
 * caller decides whether that reads as `0` or as "not a series".
 */
export function sumBucketValues<TChart extends BaseChartSchema>(
  data: TChart[],
  from: number,
  to: number,
): Record<string, number> {
  const [start, end] = from <= to ? [from, to] : [to, from];

  const totals: Record<string, number> = {};
  for (const bucket of data) {
    if (bucket.timestamp < start || bucket.timestamp > end) continue;
    for (const [key, value] of Object.entries(bucket)) {
      if (key === "timestamp") continue;
      // the index signature promises `number`, runtime data doesn't
      if (typeof value === "number" && Number.isFinite(value)) {
        totals[key] = (totals[key] ?? 0) + value;
      }
    }
  }
  return totals;
}

/**
 * The time each bucket covers, derived from the gap between the first two
 * buckets. Returns `0` when there aren't enough buckets to tell.
 */
export function getBucketInterval<TChart extends BaseChartSchema>(
  data: TChart[],
): number {
  if (data.length < 2) return 0;
  return Math.abs(data[1].timestamp - data[0].timestamp);
}

/**
 * The timestamp range a drag between two bucket labels covers.
 *
 * A drag selects whole buckets, so the last one contributes its full interval
 * rather than zero time. That leaves two different ends:
 *
 * - `displayEnd` is exclusive — the instant the last bucket runs out, which is
 *   what a time range reads as ("14:02 → 14:09") and what the duration measures.
 * - `filterEnd` is inclusive, because `inDateRange` compares with `<=`. It stops
 *   one millisecond short so a row landing exactly on the next bucket's first
 *   instant isn't filtered in while `sumBucketRows` never counted it.
 *
 * Returns `null` when either label isn't a parseable date.
 */
export function getSelectionBounds<TChart extends BaseChartSchema>(
  data: TChart[],
  labelA: string,
  labelB: string,
): {
  from: number;
  toBucket: number;
  displayEnd: number;
  filterEnd: number;
} | null {
  const [from, toBucket] = [
    new Date(labelA).getTime(),
    new Date(labelB).getTime(),
  ].sort((a, b) => a - b);
  if (Number.isNaN(from) || Number.isNaN(toBucket)) return null;

  const interval = getBucketInterval(data);
  return {
    from,
    toBucket,
    displayEnd: toBucket + interval,
    // a single-bucket chart has no interval to add; don't invert the range
    filterEnd: toBucket + Math.max(interval - 1, 0),
  };
}

/**
 * Formats a selected range for the readout, both ends kept apart so the caller
 * can style the separator (e.g. `Jul 21 16:52` / `17:02`).
 *
 * The date always leads - a bare `16:52 → 17:02` reads as "today" when it may
 * well be last week - and repeats on the right only across midnight. Seconds
 * show up on the tightest period, where minutes would print both ends alike.
 */
export function formatSelectionRange(
  from: number,
  to: number,
  period?: "10m" | "1d" | "1w" | "1mo",
): { start: string; end: string } {
  const timePattern = period === "10m" ? "HH:mm:ss" : "HH:mm";
  return {
    start: format(from, `LLL dd ${timePattern}`),
    end: isSameDay(from, to)
      ? format(to, timePattern)
      : format(to, `LLL dd ${timePattern}`),
  };
}

/** An SVG rect - spreadable straight onto `<rect>` or `<foreignObject>`. */
export type Box = { x: number; y: number; width: number; height: number };

/**
 * The left edge that centers `width` on `center` without leaving the plot.
 * Every overlay is positioned against the selection but has to stay fully
 * visible, so a selection on a plot boundary pushes its overlays back inside.
 */
export function centerWithin(
  center: number,
  width: number,
  chartWidth: number,
) {
  // fall back to the element's own width so a not-yet-measured chart still clamps
  const max = Math.max((chartWidth || width) - width, 0);
  return Math.min(Math.max(center - width / 2, 0), max);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

/** Width of the vertical line marking each end of the selection. */
export const SELECTION_EDGE_WIDTH = 1;
/** Width of the rounded grip sitting on the middle of each edge. */
export const SELECTION_GRIP_WIDTH = 2;
const SELECTION_GRIP_RATIO = 0.4;
const SELECTION_GRIP_MIN_HEIGHT = 8;
const SELECTION_GRIP_MAX_HEIGHT = 24;

/** Brush-style ends: a full-height line per side with a grip centered on it. */
export function getSelectionEdges(
  selection: Box,
  chartWidth: number,
): { line: Box; grip: Box & { rx: number } }[] {
  const gripHeight = clamp(
    selection.height * SELECTION_GRIP_RATIO,
    SELECTION_GRIP_MIN_HEIGHT,
    Math.min(SELECTION_GRIP_MAX_HEIGHT, selection.height),
  );

  return [selection.x, selection.x + selection.width].map((center) => ({
    line: {
      x: centerWithin(center, SELECTION_EDGE_WIDTH, chartWidth),
      y: selection.y,
      width: SELECTION_EDGE_WIDTH,
      height: selection.height,
    },
    grip: {
      x: centerWithin(center, SELECTION_GRIP_WIDTH, chartWidth),
      y: selection.y + (selection.height - gripHeight) / 2,
      width: SELECTION_GRIP_WIDTH,
      height: gripHeight,
      rx: SELECTION_GRIP_WIDTH / 2,
    },
  }));
}

/**
 * Rects covering everything left and right of the selection, to fade the
 * buckets outside it. Empty sides are dropped so a selection touching a plot
 * boundary doesn't emit a zero-width rect.
 */
export function getSelectionScrim(selection: Box, chartWidth: number): Box[] {
  const end = selection.x + selection.width;
  return [
    { x: 0, width: Math.max(selection.x, 0) },
    { x: end, width: Math.max(chartWidth - end, 0) },
  ]
    .filter((rect) => rect.width > 0)
    .map((rect) => ({ ...rect, y: selection.y, height: selection.height }));
}

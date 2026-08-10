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
 * The two bucket labels of a drag, oldest first.
 *
 * A drag can run right-to-left, and `ReferenceArea` reads `x1` as the rect's
 * start edge and `x2` as its end - handed the labels in the order they were
 * touched, a backwards drag renders a rect a bucket short on either side.
 *
 * Unparseable labels keep the order they came in: there is nothing to sort by,
 * and `getSelectionBounds` rejects them anyway.
 */
export function orderSelectionLabels(
  labelA: string,
  labelB: string,
): [string, string] {
  const a = new Date(labelA).getTime();
  const b = new Date(labelB).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return [labelA, labelB];
  return a <= b ? [labelA, labelB] : [labelB, labelA];
}

/**
 * Whether a recharts callback came from a real pointer.
 *
 * `accessibilityLayer` spoofs a mouse move at its keyboard cursor - the first
 * bucket, until an arrow key moves it - whenever the chart takes focus, which a
 * mousedown does. The spoof passes a bare `{ pageX, pageY }`, a real event a `type`.
 */
export function isPointerEvent(event: unknown): boolean {
  return typeof (event as { type?: unknown } | null | undefined)?.type === "string"; // prettier-ignore
}

/** How much time the chart covers - it decides how every label is formatted. */
export type ChartPeriod = "10m" | "1d" | "1w" | "1mo";

/**
 * An x-axis tick, as coarse as the period the chart covers.
 *
 * Shared with the labels the selection puts on the axis, so a selection edge
 * can't print its instant in a different format than the ticks around it.
 */
export function formatAxisTick(
  value: number | string,
  period?: ChartPeriod,
): string {
  const date = new Date(value);
  if (isNaN(date.getTime())) return "N/A";
  switch (period) {
    case "10m":
      return format(date, "HH:mm:ss");
    case "1d":
      return format(date, "HH:mm");
    case "1w":
      return format(date, "LLL dd HH:mm");
    default:
      return format(date, "LLL dd, y");
  }
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
  period?: ChartPeriod,
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

/** The breathing room left between the card and the selection it belongs to. */
export const SELECTION_CARD_GAP = 8;

/**
 * The left edge for the card describing a selection.
 *
 * A selection wider than the card keeps its ends visible with the card centered
 * on it, so that's where it goes. A narrow one would disappear underneath, so
 * the card steps aside - to whichever side has more room, and only if the card
 * fits there whole. When neither side does, being centered and readable beats
 * being pushed half out of the plot.
 */
export function getSelectionCardLeft(
  selection: { x: number; width: number },
  cardWidth: number,
  chartWidth: number,
  gap = SELECTION_CARD_GAP,
): number {
  const center = () =>
    centerWithin(selection.x + selection.width / 2, cardWidth, chartWidth);

  if (selection.width >= cardWidth) return center();

  const selectionEnd = selection.x + selection.width;
  const room = { left: selection.x, right: chartWidth - selectionEnd };
  const needed = cardWidth + gap;
  // the roomier side first, so the card leans away from the nearest plot edge
  const sides = room.right >= room.left ? ["right", "left"] : ["left", "right"];

  for (const side of sides) {
    if (side === "right" && room.right >= needed) return selectionEnd + gap;
    if (side === "left" && room.left >= needed) return selection.x - needed;
  }
  return center();
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
 * How far below the plot the selection's labels sit, matching where recharts
 * puts a tick: its `tickSize` (6) plus its `tickMargin` (2). They stand in for
 * the axis ticks while a selection is up, so they have to land on the same line.
 */
export const SELECTION_LABEL_OFFSET = 8;
/** The smallest gap left between the two labels before the end one is dropped. */
export const SELECTION_LABEL_GAP = 8;

/**
 * Where the labels for a selection's two edges go, each centered on its edge
 * and kept inside the plot.
 *
 * `end` is `null` when the two would touch: a narrow selection only gets to say
 * where it starts. The check runs on the clamped centers, not on the raw
 * selection width - a selection against a plot boundary has its labels pushed
 * inwards, which closes the gap the raw width says is there.
 */
export function getSelectionLabels(
  selection: Box,
  chartWidth: number,
  widths: { start: number; end: number },
): { start: { x: number; y: number }; end: { x: number; y: number } | null } {
  const y = selection.y + selection.height + SELECTION_LABEL_OFFSET;
  // `centerWithin` returns a left edge; these are drawn from their center
  const startX = centerWithin(selection.x, widths.start, chartWidth) + widths.start / 2; // prettier-ignore
  const endX = centerWithin(selection.x + selection.width, widths.end, chartWidth) + widths.end / 2; // prettier-ignore

  const gap = endX - widths.end / 2 - (startX + widths.start / 2);

  return {
    start: { x: startX, y },
    end: gap >= SELECTION_LABEL_GAP ? { x: endX, y } : null,
  };
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

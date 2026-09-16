"use client";

import type { TimelineChartSchema } from "@/app/infinite/schema";
import { Button } from "@/components/ui/button";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { getLevelLabel } from "@/lib/request/level";
import { cn } from "@/lib/utils";
import { useDataTable } from "@dtf/registry/components/data-table/data-table-provider";
import type { BaseChartSchema } from "@dtf/registry/lib/data-table/types";
import { format } from "date-fns";
import { ZoomIn } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bar, BarChart, CartesianGrid, ReferenceArea, XAxis } from "recharts";
import type { CategoricalChartFunc } from "recharts/types/chart/generateCategoricalChart";
import type { Box } from "./timeline-chart-utils";
import {
  formatAxisTick,
  formatSelectionRange,
  getSelectionBounds,
  getSelectionCardLeft,
  getSelectionEdges,
  getSelectionLabels,
  getSelectionScrim,
  isPointerEvent,
  orderSelectionLabels,
  sumBucketValues,
} from "./timeline-chart-utils";

export const description = "A stacked bar chart";

/** Shared by every control floating over the chart. */
const PILL_BUTTON =
  "flex-1 h-5 rounded-md px-1.5! py-1! font-mono text-[10px] shadow-none";

const chartConfig = {
  success: {
    label: <TooltipLabel level="success" />,
    color: "var(--success)",
  },
  warning: {
    label: <TooltipLabel level="warning" />,
    color: "var(--warning)",
  },
  error: {
    label: <TooltipLabel level="error" />,
    color: "var(--error)",
  },
} satisfies ChartConfig;

/** Stack order, bottom-up - the tooltip follows it too. */
const LEVELS = ["error", "warning", "success"] as const;

/** A selected range, both ends kept apart so the separator can be styled. */
type SelectionRange = { start: string; end: string };

interface TimelineChartProps<TChart extends BaseChartSchema> {
  className?: string;
  /**
   * The table column id to filter by - needs to be a type of `timerange` (e.g. "date").
   * TBD: if using keyof TData to be closer to the data table props
   */
  columnId: string;
  /**
   * Same data as of the InfiniteQueryMeta.
   */
  data: TChart[];
}

export function TimelineChart<TChart extends BaseChartSchema>({
  data,
  className,
  columnId,
}: TimelineChartProps<TChart>) {
  const { table } = useDataTable();
  // state, not a ref: the card is portaled into it, so a render has to follow
  // the element being attached
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [chartWidth, setChartWidth] = useState(0);
  const [refAreaLeft, setRefAreaLeft] = useState<string | null>(null);
  const [refAreaRight, setRefAreaRight] = useState<string | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);

  // REMINDER: the scrim and edges are SVG without a layout engine - we need the
  // pixel width to keep them inside the plot near either edge
  useEffect(() => {
    if (!container) return;

    setChartWidth(container.clientWidth);
    const observer = new ResizeObserver(([entry]) =>
      setChartWidth(entry.contentRect.width),
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, [container]);

  // REMINDER: date has to be a string for tooltip label to work - don't ask me why
  const chart = useMemo(
    () =>
      data.map((item) => ({
        ...item,
        [columnId]: new Date(item.timestamp).toString(),
      })),
    [data, columnId],
  );

  const timerange = useMemo(() => {
    if (data.length === 0) return { interval: 0, period: undefined };
    const first = data[0].timestamp;
    const last = data[data.length - 1].timestamp;
    const interval = Math.abs(first - last); // in ms
    return { interval, period: calculatePeriod(interval) };
  }, [data]);

  /**
   * How the selection describes itself, off the same bounds we commit as the
   * filter - so nothing on screen can disagree with what the table ends up
   * showing.
   */
  const selection = useMemo(() => {
    if (!refAreaLeft || !refAreaRight) return null;

    const bounds = getSelectionBounds(data, refAreaLeft, refAreaRight);
    if (!bounds) return null;

    const { from, toBucket, displayEnd } = bounds;

    return {
      range: formatSelectionRange(from, displayEnd, timerange.period),
      // the per-level counts the range covers. nothing shows them right now -
      // the card is the range and the actions - but they're what a breakdown
      // would be built from, and they stay in step with the bounds above
      values: sumBucketValues(data, from, toBucket),
      // the instants the two edges sit on: `from` opens the first bucket and
      // `displayEnd` is where the last one runs out, which is the boundary the
      // right edge is drawn at
      axis: {
        start: formatAxisTick(from, timerange.period),
        end: formatAxisTick(displayEnd, timerange.period),
      },
    };
  }, [refAreaLeft, refAreaRight, data, timerange.period]);

  /**
   * The selection as `ReferenceArea` wants it: `x1` is the rect's start edge
   * and `x2` its end, so a backwards drag has to be flipped or the highlight
   * comes out a bucket short on either side.
   */
  const refArea = useMemo(
    () =>
      refAreaLeft && refAreaRight
        ? orderSelectionLabels(refAreaLeft, refAreaRight)
        : null,
    [refAreaLeft, refAreaRight],
  );

  const handleMouseDown: CategoricalChartFunc = (e) => {
    if (e.activeLabel) {
      // a new drag replaces whatever was still awaiting confirmation
      setRefAreaLeft(e.activeLabel);
      setRefAreaRight(null);
      setIsSelecting(true);
    }
  };

  const handleMouseMove: CategoricalChartFunc = (e, event) => {
    // only a moving pointer widens the selection - taking the a11y layer's
    // spoofed move too (see `isPointerEvent`) would make a click select from
    // the first bucket to the bar it landed on
    if (!isPointerEvent(event)) return;
    if (isSelecting && e.activeLabel) {
      setRefAreaRight(e.activeLabel);
    }
  };

  const clearSelection = () => {
    setRefAreaLeft(null);
    setRefAreaRight(null);
    setIsSelecting(false);
  };

  const applySelection = () => {
    if (!refAreaLeft || !refAreaRight) return;
    // same bounds the readout was computed from, so the row count the user
    // just saw is exactly what the table ends up showing
    const bounds = getSelectionBounds(data, refAreaLeft, refAreaRight);
    if (bounds) {
      table
        .getColumn(columnId)
        ?.setFilterValue([new Date(bounds.from), new Date(bounds.filterEnd)]);
    }
    clearSelection();
  };

  const isPending = Boolean(!isSelecting && refAreaLeft && refAreaRight);

  // the drag ends on the window, not on the chart: wandering off the plot keeps
  // the range live and releasing anywhere parks it. it only ever parks - the
  // filter is applied from the zoom button, so an imprecise drag can be
  // corrected instead of refetching the table twice.
  // both listener effects run without a dep array: they close over the current
  // selection, and re-subscribing beats memoizing every callback to stay stable
  useEffect(() => {
    if (!isSelecting) return;
    const onMouseUp = () => {
      setIsSelecting(false);
      // a click without a drag is the shortest range there is: the one bucket
      // under the cursor. `x1 === x2` still spans a full band
      if (!refAreaRight) setRefAreaRight(refAreaLeft);
    };
    // dragging across the page would otherwise select the table's text
    document.body.classList.add("select-none");
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      document.body.classList.remove("select-none");
      window.removeEventListener("mouseup", onMouseUp);
    };
  });

  useEffect(() => {
    if (!isPending) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") clearSelection();
      // the browser already activates a focused Cancel - zooming here too would
      // do both at once
      if (event.key === "Enter" && !hasInteractiveFocus()) applySelection();
    };
    // anywhere but the chart dismisses it. the card is portaled into the
    // container, so its own buttons count as inside
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && container?.contains(target)) return;
      clearSelection();
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  });

  return (
    <div ref={setContainer} className="relative">
      <ChartContainer
        config={chartConfig}
        className={cn(
          "aspect-auto h-[60px] w-full",
          "[&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted/50", // otherwise same color as 200
          "select-none", // disable text selection
          "touch-pan-y", // capture horizontal drags, let vertical page scroll through
          className,
        )}
      >
        <BarChart
          accessibilityLayer
          data={chart}
          margin={{ top: 0, left: 0, right: 0, bottom: 0 }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          style={{ cursor: "crosshair" }}
        >
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey={columnId}
            tickLine={false}
            minTickGap={32}
            axisLine={false}
            // interval="preserveStartEnd"
            // the selection labels the axis itself while it's up, so the ticks
            // step aside rather than compete with it - but only once there is
            // something to replace them with. the axis keeps its height either way
            tick={!selection}
            tickFormatter={(value) => formatAxisTick(value, timerange.period)}
          />
          <ChartTooltip
            // defaultIndex={10}
            // no hover while a selection is on the chart: mid-drag it fights the
            // band being dragged, and once parked it covers the actions.
            // recharts reads `active` before its own hover state, and only when
            // it's defined - `undefined` hands control back
            active={isSelecting || isPending ? false : undefined}
            content={
              <ChartTooltipContent
                labelFormatter={(value) => {
                  const date = new Date(value);
                  if (isNaN(date.getTime())) return "N/A";
                  if (timerange.period === "10m") {
                    return format(date, "LLL dd, HH:mm:ss");
                  }
                  return format(date, "LLL dd, y HH:mm");
                }}
              />
            }
          />
          {LEVELS.map((level) => (
            <Bar
              key={level}
              dataKey={level}
              stackId="a"
              fill={`var(--color-${level})`}
            />
          ))}
          {refArea && (
            <ReferenceArea
              x1={refArea[0]}
              x2={refArea[1]}
              stroke="none"
              fill="var(--foreground)"
              fillOpacity={0.05}
              label={
                <SelectionOverlay
                  chartWidth={chartWidth}
                  container={container}
                  axisLabels={selection?.axis ?? null}
                  // nothing floats over the chart mid-drag: the shaded band and
                  // its edges already describe the range, and a card chasing the
                  // cursor only reads as the tooltip refusing to go away. it
                  // comes back once the drag parks, where it carries the actions
                  range={isPending ? (selection?.range ?? null) : null}
                  actions={
                    isPending
                      ? { onZoom: applySelection, onCancel: clearSelection }
                      : null
                  }
                />
              }
            />
          )}
        </BarChart>
      </ChartContainer>
    </div>
  );
}

/**
 * The selection: brush-style ends, the buckets outside it faded, and the card
 * describing the range.
 *
 * Rendered through `ReferenceArea`'s `label` prop - recharts clones it with the
 * selection rect as `viewBox`, which is the exact band-snapped geometry. The
 * scrim and edges stay in the SVG; the card is portaled out of it (see
 * `SelectionCard`).
 */
function SelectionOverlay({
  viewBox,
  chartWidth,
  container,
  axisLabels,
  range,
  actions,
}: {
  /** injected by recharts, not passed by the parent */
  viewBox?: { x?: number; y?: number; width?: number; height?: number };
  chartWidth: number;
  container: HTMLElement | null;
  axisLabels?: SelectionRange | null;
  range?: SelectionRange | null;
  actions?: { onZoom: () => void; onCancel: () => void } | null;
}) {
  if (!viewBox) return null;

  const selection = {
    x: viewBox.x ?? 0,
    y: viewBox.y ?? 0,
    width: viewBox.width ?? 0,
    height: viewBox.height ?? 0,
  };

  return (
    <g className="pointer-events-none">
      {/* fade the buckets outside the selection so the range reads at a glance */}
      {getSelectionScrim(selection, chartWidth).map((rect) => (
        <rect
          key={rect.x}
          {...rect}
          fill="var(--background)"
          fillOpacity={0.6}
        />
      ))}
      {getSelectionEdges(selection, chartWidth).map(({ line, grip }, index) => (
        <g key={index} fill="var(--foreground)">
          <rect {...line} />
          <rect {...grip} />
        </g>
      ))}
      {axisLabels ? (
        <SelectionAxisLabels
          selection={selection}
          chartWidth={chartWidth}
          labels={axisLabels}
        />
      ) : null}
      {range && actions && container
        ? createPortal(
            <SelectionCard
              selection={selection}
              chartWidth={chartWidth}
              range={range}
              actions={actions}
            />,
            container,
          )
        : null}
    </g>
  );
}

/**
 * The two instants the selection runs between, drawn where the axis ticks would
 * have been - the ticks are off while a selection is up, so the only dates on
 * the axis are the ones the selection is about.
 *
 * The end label is dropped when the two would touch: a narrow selection only
 * gets to say where it starts. It stays mounted and merely hidden, because
 * unmounting it would throw away the width that decision is made from - and the
 * decision would flip back on the next frame.
 */
function SelectionAxisLabels({
  selection,
  chartWidth,
  labels,
}: {
  selection: Box;
  chartWidth: number;
  labels: { start: string; end: string };
}) {
  const startRef = useRef<SVGTextElement>(null);
  const endRef = useRef<SVGTextElement>(null);
  const [widths, setWidths] = useState({ start: 0, end: 0 });

  // before paint, so a label never shows up off-center for a frame
  useLayoutEffect(() => {
    setWidths({
      start: startRef.current?.getComputedTextLength() ?? 0,
      end: endRef.current?.getComputedTextLength() ?? 0,
    });
  }, [labels.start, labels.end]);

  const { start, end } = getSelectionLabels(selection, chartWidth, widths);

  return (
    // `dy` is what recharts hangs its own tick text from (`capHeight`), so these
    // sit on the same line the ticks would have
    <g className="fill-muted-foreground" textAnchor="middle">
      <text ref={startRef} x={start.x} y={start.y} dy="0.71em">
        {labels.start}
      </text>
      <text
        ref={endRef}
        x={end?.x ?? start.x}
        y={start.y}
        dy="0.71em"
        visibility={end ? undefined : "hidden"}
      >
        {labels.end}
      </text>
    </g>
  );
}

/**
 * The range description and the actions to confirm it, shown once the drag is
 * released. One card rather than two: the range is what you're confirming.
 *
 * Portaled to the chart container instead of drawn in the SVG. An `<svg>` clips
 * to its viewport, so a card this tall lost its shadow and its bottom edge to
 * the plot boundary; as a DOM sibling it can overflow the chart the same way
 * the recharts tooltip does. It measures itself, so nothing here estimates text
 * width.
 */
function SelectionCard({
  selection,
  chartWidth,
  range,
  actions,
}: {
  selection: Box;
  chartWidth: number;
  range: SelectionRange;
  actions: { onZoom: () => void; onCancel: () => void };
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  // before paint, so the card never shows up off-center for a frame
  useLayoutEffect(() => {
    setWidth(ref.current?.offsetWidth ?? 0);
  }, [range.start, range.end]);

  return (
    // same shell as `ChartTooltipContent` - the card replaces the tooltip
    <div
      ref={ref}
      style={{ left: getSelectionCardLeft(selection, width, chartWidth) }}
      className="border-border/50 bg-background pointer-events-none absolute top-0 grid w-max min-w-[8rem] items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl"
    >
      <div className="font-medium">
        {range.start}
        <span className="text-muted-foreground mx-1 font-normal">→</span>
        {range.end}
      </div>
      <div
        className="border-border/50 pointer-events-auto -mx-2.5 -mb-1.5 flex items-center gap-1 border-t px-2.5 py-1.5"
        // a portal bubbles through the React tree, not the DOM one - without
        // this a click on either button reaches the chart and starts a drag
        onMouseDown={(event) => event.stopPropagation()}
        onMouseUp={(event) => event.stopPropagation()}
      >
        <Button
          variant="outline"
          className={PILL_BUTTON}
          onClick={actions.onCancel}
        >
          Cancel
        </Button>
        <Button className={cn(PILL_BUTTON, "gap-1")} onClick={actions.onZoom}>
          <ZoomIn className="size-2.5!" />
          <span>Zoom</span>
        </Button>
      </div>
    </div>
  );
}

/** Whether the focused element handles Enter itself - the shortcut defers to it. */
function hasInteractiveFocus(): boolean {
  return Boolean(
    document.activeElement?.closest(
      "button, a, input, textarea, select, [contenteditable], [role='button']",
    ),
  );
}

// TODO: check what's a good abbreviation for month vs. minutes
function calculatePeriod(interval: number): "10m" | "1d" | "1w" | "1mo" {
  if (interval <= 1000 * 60 * 10) {
    // less than 10 minutes
    return "10m";
  } else if (interval <= 1000 * 60 * 60 * 24) {
    // less than 1 day
    return "1d";
  } else if (interval <= 1000 * 60 * 60 * 24 * 7) {
    // less than 1 week
    return "1w";
  }
  return "1mo"; // defaults to 1 month
}

// TODO: use a `formatTooltipLabel` function instead for composability
function TooltipLabel({
  level,
}: {
  level: keyof Omit<TimelineChartSchema, "timestamp">;
}) {
  return (
    <div className="mr-2 flex w-20 items-center justify-between gap-2 font-mono">
      <div className="text-foreground/70 capitalize">{level}</div>
      <div className="text-muted-foreground/70 text-xs">
        {getLevelLabel(level)}
      </div>
    </div>
  );
}

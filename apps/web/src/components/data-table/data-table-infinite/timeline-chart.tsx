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
import { X, ZoomIn } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bar, BarChart, CartesianGrid, ReferenceArea, XAxis } from "recharts";
import type { CategoricalChartFunc } from "recharts/types/chart/generateCategoricalChart";
import {
  centerWithin,
  formatSelectionRange,
  getSelectionBounds,
  getSelectionEdges,
  getSelectionScrim,
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

/** Stack order, bottom-up - the tooltip and the selection card follow it too. */
const LEVELS = ["error", "warning", "success"] as const;

type SelectionReadout = {
  range: { start: string; end: string };
  values: Record<string, number>;
};

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
  const { table, columnFilters } = useDataTable();
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
   * The buckets currently under the drag, in the same bounds we commit as the
   * filter - so the readout can't disagree with what the table ends up showing.
   */
  const selection = useMemo(() => {
    if (!refAreaLeft || !refAreaRight) return null;

    const bounds = getSelectionBounds(data, refAreaLeft, refAreaRight);
    if (!bounds) return null;

    const { from, toBucket, displayEnd } = bounds;

    return {
      range: formatSelectionRange(from, displayEnd, timerange.period),
      values: sumBucketValues(data, from, toBucket),
    };
  }, [refAreaLeft, refAreaRight, data, timerange.period]);

  const hasFilter = Boolean(
    columnFilters.find((filter) => filter.id === columnId)?.value,
  );

  const handleMouseDown: CategoricalChartFunc = (e) => {
    if (e.activeLabel) {
      // a new drag replaces whatever was still awaiting confirmation
      setRefAreaLeft(e.activeLabel);
      setRefAreaRight(null);
      setIsSelecting(true);
    }
  };

  const handleMouseMove: CategoricalChartFunc = (e) => {
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
      // a click without a drag isn't a range - don't leave a pending selection
      if (!refAreaRight) setRefAreaLeft(null);
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
          // no hover while a selection is on the chart: mid-drag the readout
          // replaces the tooltip, and once pending it covers the actions
          (isSelecting || isPending) &&
            "[&_.recharts-tooltip-cursor]:hidden [&_.recharts-tooltip-wrapper]:hidden",
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
            tickFormatter={(value) => {
              const date = new Date(value);
              if (isNaN(date.getTime())) return "N/A";
              if (timerange.period === "10m") {
                return format(date, "HH:mm:ss");
              } else if (timerange.period === "1d") {
                return format(date, "HH:mm");
              } else if (timerange.period === "1w") {
                return format(date, "LLL dd HH:mm");
              }
              return format(date, "LLL dd, y");
            }}
          />
          <ChartTooltip
            // defaultIndex={10}
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
          {refAreaLeft && refAreaRight && (
            <ReferenceArea
              x1={refAreaLeft}
              x2={refAreaRight}
              stroke="none"
              fill="var(--foreground)"
              fillOpacity={0.05}
              label={
                <SelectionOverlay
                  chartWidth={chartWidth}
                  container={container}
                  readout={selection}
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
      {hasFilter && !isSelecting && !isPending ? (
        <Button
          variant="outline"
          className={cn(PILL_BUTTON, "absolute top-0 right-0 gap-1")}
          onClick={() => table.getColumn(columnId)?.setFilterValue(undefined)}
        >
          <span>Reset</span>
          <X className="text-muted-foreground size-2.5!" />
        </Button>
      ) : null}
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
  readout,
  actions,
}: {
  /** injected by recharts, not passed by the parent */
  viewBox?: { x?: number; y?: number; width?: number; height?: number };
  chartWidth: number;
  container: HTMLElement | null;
  readout?: SelectionReadout | null;
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
      {readout && container
        ? createPortal(
            <SelectionCard
              center={selection.x + selection.width / 2}
              chartWidth={chartWidth}
              readout={readout}
              actions={actions}
            />,
            container,
          )
        : null}
    </g>
  );
}

/**
 * The range description, and - once the drag is released - the actions to
 * confirm it. One card rather than two: the range is what you're confirming.
 *
 * Portaled to the chart container instead of drawn in the SVG. An `<svg>` clips
 * to its viewport, so a card this tall lost its shadow and its bottom edge to
 * the plot boundary; as a DOM sibling it can overflow the chart the same way
 * the recharts tooltip does. It measures itself, so nothing here estimates text
 * width.
 */
function SelectionCard({
  center,
  chartWidth,
  readout,
  actions,
}: {
  center: number;
  chartWidth: number;
  readout: SelectionReadout;
  actions?: { onZoom: () => void; onCancel: () => void } | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const hasActions = Boolean(actions);

  // before paint, so the card never shows up off-center for a frame
  useLayoutEffect(() => {
    setWidth(ref.current?.offsetWidth ?? 0);
  }, [readout.range.start, readout.range.end, hasActions]);

  return (
    // same shell as `ChartTooltipContent` - the card replaces the tooltip
    <div
      ref={ref}
      style={{ left: centerWithin(center, width, chartWidth) }}
      className="border-border/50 bg-background pointer-events-none absolute top-0 grid w-max min-w-[8rem] items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl"
    >
      <div className="font-medium">
        {readout.range.start}
        <span className="text-muted-foreground mx-1 font-normal">→</span>
        {readout.range.end}
      </div>
      <div className="grid gap-1.5">
        {LEVELS.map((level) => (
          <div key={level} className="flex w-full flex-wrap items-center gap-2">
            <div
              className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
              style={{ background: chartConfig[level].color }}
            />
            <div className="flex flex-1 items-center justify-between leading-none">
              <span className="text-muted-foreground">
                {chartConfig[level].label}
              </span>
              <span className="text-foreground font-mono font-medium tabular-nums">
                {(readout.values[level] ?? 0).toLocaleString()}
              </span>
            </div>
          </div>
        ))}
      </div>
      {actions ? (
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
      ) : null}
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

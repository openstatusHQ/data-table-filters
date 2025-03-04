"use client";

import { Bar, BarChart, CartesianGrid, ReferenceArea, XAxis } from "recharts";

import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { CategoricalChartFunc } from "recharts/types/chart/generateCategoricalChart";
import { getLevelLabel } from "@/lib/request/level";
import { useDataTable } from "@/components/data-table/data-table-provider";
import { BaseChartSchema, TimelineChartSchema } from "./schema";

export const description = "A stacked bar chart";

const chartConfig = {
  success: {
    label: <TooltipLabel level="success" />,
    color: "hsl(var(--success))",
  },
  warning: {
    label: <TooltipLabel level="warning" />,
    color: "hsl(var(--warning))",
  },
  error: {
    label: <TooltipLabel level="error" />,
    color: "hsl(var(--error))",
  },
} satisfies ChartConfig;

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
  const [refAreaLeft, setRefAreaLeft] = useState<string | null>(null);
  const [refAreaRight, setRefAreaRight] = useState<string | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);

  // REMINDER: date has to be a string for tooltip label to work - don't ask me why
  // FIXME: move to server
  const chart = useMemo(
    () =>
      data.map((item) => ({
        ...item,
        [columnId]: new Date(item.timestamp).toString(),
      })),
    [data],
  );

  // REMINDER: time difference (ms) between the first and last timestamp
  const interval = useMemo(() => {
    if (data.length === 0) return 0;
    return Math.abs(data[0].timestamp - data[data.length - 1].timestamp);
  }, [data]);

  const handleMouseDown: CategoricalChartFunc = (e) => {
    if (e.activeLabel) {
      setRefAreaLeft(e.activeLabel);
      setIsSelecting(true);
    }
  };

  const handleMouseMove: CategoricalChartFunc = (e) => {
    if (isSelecting && e.activeLabel) {
      setRefAreaRight(e.activeLabel);
    }
  };

  const handleMouseUp: CategoricalChartFunc = (e) => {
    if (refAreaLeft && refAreaRight) {
      const [left, right] = [refAreaLeft, refAreaRight].sort(
        (a, b) => new Date(a).getTime() - new Date(b).getTime(),
      );
      table
        .getColumn(columnId)
        ?.setFilterValue([new Date(left), new Date(right)]);
    }
    setRefAreaLeft(null);
    setRefAreaRight(null);
    setIsSelecting(false);
  };

  return (
    <ChartContainer
      config={chartConfig}
      className={cn(
        "aspect-auto h-[60px] w-full",
        "[&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted/50", // otherwise same color as 200
        "select-none", // disable text selection
        className,
      )}
    >
      <BarChart
        accessibilityLayer
        data={chart}
        margin={{ top: 0, left: 0, right: 0, bottom: 0 }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: "crosshair" }}
      >
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey={columnId}
          tickLine={false}
          minTickGap={32}
          axisLine={false}
          tickFormatter={(value) => {
            const date = new Date(value);
            if (isNaN(date.getTime())) return "N/A";
            // TODO: how to extract into helper functions
            if (interval <= 1000 * 60 * 10) {
              return format(date, "HH:mm:ss");
            } else if (interval <= 1000 * 60 * 60 * 24) {
              return format(date, "HH:mm");
            } else if (interval <= 1000 * 60 * 60 * 24 * 7) {
              return format(date, "LLL dd HH:mm");
            }
            return format(date, "LLL dd, y");
          }}
          // interval="preserveStartEnd"
        />
        <ChartTooltip
          // defaultIndex={10}
          content={
            <ChartTooltipContent
              labelFormatter={(value) => {
                const date = new Date(value);
                if (isNaN(date.getTime())) return "N/A";
                // TODO: how to extract into helper functions
                if (interval <= 1000 * 60 * 10) {
                  return format(date, "LLL dd, HH:mm:ss");
                }
                return format(date, "LLL dd, y HH:mm");
              }}
            />
          }
        />
        {/* TODO: we could use the `{timestamp, ...rest} = data[0]` to dynamically create the bars but that would mean the order can be very much random */}
        <Bar dataKey="error" stackId="a" fill="var(--color-error)" />
        <Bar dataKey="warning" stackId="a" fill="var(--color-warning)" />
        <Bar dataKey="success" stackId="a" fill="var(--color-success)" />
        {refAreaLeft && refAreaRight && (
          <ReferenceArea
            x1={refAreaLeft}
            x2={refAreaRight}
            strokeOpacity={0.3}
            fill="hsl(var(--foreground))"
            fillOpacity={0.08}
          />
        )}
      </BarChart>
    </ChartContainer>
  );
}

// TODO: use a `formatTooltipLabel` function instead for composability
function TooltipLabel({
  level,
}: {
  level: keyof Omit<TimelineChartSchema, "timestamp">;
}) {
  return (
    <div className="mr-2 flex w-20 items-center justify-between gap-2 font-mono">
      <div className="capitalize text-foreground/70">{level}</div>
      <div className="text-xs text-muted-foreground/70">
        {getLevelLabel(level)}
      </div>
    </div>
  );
}

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
import { ColumnFiltersColumn } from "@tanstack/react-table";

export const description = "A stacked bar chart with a legend";

const chartConfig = {
  200: {
    label: <span className="font-mono">200</span>,
    // color: "hsl(var(--chart-1))",
    // color: "hsl(142.1 70.6% 45.3%)", // bg-green-500
    // color: "hsla(142.1, 70.6%, 45.3%, 0.3)", // bg-green-500/30
    color: "hsl(var(--muted))", // bg-foreground/10
  },
  400: {
    label: <span className="font-mono">400</span>,
    // color: "hsl(var(--chart-2))",
    color: "hsl(24.6 95% 53.1%)", // bg-orange-500
  },
  500: {
    label: <span className="font-mono">500</span>,
    // color: "hsl(var(--chart-3))",
    color: "hsl(0 84.2% 60.2%)", // bg-red-500
  },
} satisfies ChartConfig;

// TODO: create some sort of Skeleton
export function TimelineChart({
  data,
  className,
  handleFilter,
}: {
  data: { timestamp: number; [key: string]: number }[];
  className?: string;
  // FIXME: check how to make it more versatile - pass `table` instead?
  handleFilter?: ColumnFiltersColumn<unknown>["setFilterValue"];
}) {
  const [refAreaLeft, setRefAreaLeft] = useState<string | null>(null);
  const [refAreaRight, setRefAreaRight] = useState<string | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);

  // TODO: check why timestamp cannot be a number
  // FIXME: move to server
  const chart = useMemo(
    () =>
      data.map((item) => ({
        ...item,
        date: new Date(item.timestamp).toString(),
      })),
    [data]
  );

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
        (a, b) => new Date(a).getTime() - new Date(b).getTime()
      );
      handleFilter?.([new Date(left), new Date(right)]);
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
        className
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
          dataKey="date"
          tickLine={false}
          minTickGap={32}
          axisLine={false}
          tickFormatter={(value) => {
            if (interval <= 1000 * 60 * 10) {
              return format(new Date(value), "HH:mm:ss");
            } else if (interval <= 1000 * 60 * 60 * 24) {
              return format(new Date(value), "HH:mm");
            } else if (interval <= 1000 * 60 * 60 * 24 * 7) {
              return format(new Date(value), "LLL dd HH:mm");
            }
            return format(new Date(value), "LLL dd, y");
          }}
          interval="preserveStartEnd"
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(value) => {
                if (interval <= 1000 * 60 * 10) {
                  return format(new Date(value), "LLL dd, HH:mm:ss");
                }
                return format(new Date(value), "LLL dd, y HH:mm");
              }}
            />
          }
        />
        <Bar dataKey="500" stackId="a" fill="var(--color-500)" />
        <Bar dataKey="400" stackId="a" fill="var(--color-400)" />
        <Bar dataKey="200" stackId="a" fill="var(--color-200)" />
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

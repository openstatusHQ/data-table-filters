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
import { getLevelLabel } from "@/lib/request/level";
import { LEVELS } from "@/constants/levels";

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

  // REMINDER: date has to be a string for tooltip label to work - don't ask me why
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
        "select-none", // disable text selection
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
          // interval="preserveStartEnd"
        />
        <ChartTooltip
          // defaultIndex={10}
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
        LEVELS
      </BarChart>
    </ChartContainer>
  );
}

function TooltipLabel({ level }: { level: (typeof LEVELS)[number] }) {
  return (
    <div className="font-mono flex w-20 justify-between items-center gap-2 mr-2">
      <div className="capitalize text-foreground/70">{level}</div>
      <div className="text-xs text-muted-foreground/70">
        {getLevelLabel(level)}
      </div>
    </div>
  );
}

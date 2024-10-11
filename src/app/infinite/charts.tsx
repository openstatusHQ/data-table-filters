"use client";

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { useMemo } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

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
export function Charts({
  data,
  className,
}: {
  data: { timestamp: number; [key: string]: number }[];
  className?: string;
}) {
  // TODO: check why timestamp cannot be a number
  //   FIXME: move to server
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

  return (
    <ChartContainer
      config={chartConfig}
      className={cn("aspect-auto h-[60px] w-full", className)}
    >
      <BarChart
        accessibilityLayer
        data={chart}
        margin={{ top: 0, left: 0, right: 0, bottom: 0 }}
      >
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="date"
          tickLine={false}
          minTickGap={32}
          axisLine={false}
          tickFormatter={(value) => {
            if (interval <= 1000 * 60) {
              return format(new Date(value), "HH:mm:ss");
            } else if (interval <= 1000 * 60 * 60 * 24) {
              return format(new Date(value), "HH:mm");
            } else if (interval <= 1000 * 60 * 60 * 24 * 7) {
              return format(new Date(value), "LLL dd HH:mm");
            }
            return format(new Date(value), "LLL dd, y");
          }}
        />
        <Bar dataKey="500" stackId="a" fill="var(--color-500)" />
        <Bar dataKey="400" stackId="a" fill="var(--color-400)" />
        <Bar dataKey="200" stackId="a" fill="var(--color-200)" />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(value) => {
                if (interval <= 1000 * 60) {
                  return format(new Date(value), "HH:mm:ss");
                }
                return format(new Date(value), "LLL dd, y HH:mm");
              }}
            />
          }
          cursor={false}
        />
      </BarChart>
    </ChartContainer>
  );
}

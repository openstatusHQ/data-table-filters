"use client";

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { useMemo } from "react";

export const description = "A stacked bar chart with a legend";

const chartData = [
  { timestamp: "2024-07-15", 200: 450, 500: 300 },
  { timestamp: "2024-07-16", 200: 380, 500: 420 },
  { timestamp: "2024-07-17", 200: 520, 500: 120 },
  { timestamp: "2024-07-18", 200: 140, 500: 550 },
  { timestamp: "2024-07-19", 200: 600, 500: 350 },
  { timestamp: "2024-07-20", 200: 480, 500: 400 },
];

const chartConfig = {
  200: {
    label: "200",
    // color: "hsl(var(--chart-1))",
    // color: "hsl(142.1 70.6% 45.3%)", // bg-green-500
    color: "hsla(142.1, 70.6%, 45.3%, 0.4)", // bg-green-500/10
    // color: "hsl(var(--muted))", // bg-foreground/10
  },
  400: {
    label: "400",
    // color: "hsl(var(--chart-2))",
    color: "hsl(24.6 95% 53.1%)", // bg-orange-500
  },
  500: {
    label: "500",
    // color: "hsl(var(--chart-3))",
    color: "hsl(0 84.2% 60.2%)", // bg-red-500
  },
} satisfies ChartConfig;

// TODO: create some sort of Skeleton

// TODO: rename
export function Component({
  data,
}: {
  data: { timestamp: number; [key: string]: number }[];
}) {
  // TODO: check why timestamp cannot be a number
  const chart = useMemo(
    () =>
      data.map((item) => ({
        ...item,
        timestamp: new Date(item.timestamp).toDateString(),
      })),
    [data]
  );

  return (
    <ChartContainer
      config={chartConfig}
      className="aspect-auto h-[80px] w-full"
    >
      <BarChart accessibilityLayer data={chart}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="timestamp"
          tickLine={false}
          //   tickMargin={10}
          //   minTickGap={32}
          axisLine={false}
          tickFormatter={(value) => {
            return new Date(value).toLocaleDateString("en-US", {
              day: "numeric",
              month: "long",
            });
          }}
        />
        <Bar dataKey="500" stackId="a" fill="var(--color-500)" />
        <Bar dataKey="400" stackId="a" fill="var(--color-400)" />
        <Bar dataKey="200" stackId="a" fill="var(--color-200)" />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(value) => {
                return new Date(value).toLocaleDateString("en-US", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                });
              }}
            />
          }
          cursor={false}
        />
      </BarChart>
    </ChartContainer>
  );
}

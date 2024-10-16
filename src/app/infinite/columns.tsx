"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Check, Minus, X } from "lucide-react";
import type { ColumnSchema } from "./schema";
import { format } from "date-fns";
import { getStatusColor } from "@/lib/request/status-code";
import { regions } from "@/constants/region";
import {
  getTimingColor,
  getTimingLabel,
  getTimingPercentage,
  timingPhases,
} from "@/lib/request/timing";
import { cn } from "@/lib/utils";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import TextWithTooltip from "@/components/custom/text-with-tooltip";
import { UTCDate } from "@date-fns/utc";

const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

export const columns: ColumnDef<ColumnSchema>[] = [
  {
    accessorKey: "success",
    header: "",
    cell: ({ row }) => {
      const value = row.getValue("success");
      if (value) return <Check className="h-4 w-4 text-green-500/60" />;
      return <X className="h-4 w-4 text-red-500" />;
    },
    filterFn: "arrSome",
    meta: { headerClassName: "w-4" },
  },
  {
    id: "uuid",
    accessorKey: "uuid",
    header: "UUID",
    cell: ({ row }) => {
      const value = row.getValue("uuid") as string;
      return (
        <TextWithTooltip className="font-mono max-w-[85px]" text={value} />
      );
    },
    meta: {
      label: "UUID",
    },
  },
  {
    accessorKey: "date",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Date" />
    ),
    cell: ({ row }) => {
      const date = new Date(row.getValue("date"));
      return (
        <HoverCard openDelay={0} closeDelay={0}>
          <HoverCardTrigger asChild>
            <div className="font-mono whitespace-nowrap">
              {format(date, "LLL dd, y HH:mm:ss")}
            </div>
          </HoverCardTrigger>
          <HoverCardContent
            side="right"
            align="start"
            alignOffset={-4}
            className="p-2 w-auto z-10"
          >
            <dl className="flex flex-col gap-1">
              <div className="flex gap-4 text-sm justify-between items-center">
                <dt className="text-muted-foreground">Timestamp</dt>
                <dd className="font-mono truncate">{date.getTime()}</dd>
              </div>
              <div className="flex gap-4 text-sm justify-between items-center">
                <dt className="text-muted-foreground">UTC</dt>
                <dd className="font-mono truncate">
                  {format(new UTCDate(date), "LLL dd, y HH:mm:ss")}
                </dd>
              </div>
              <div className="flex gap-4 text-sm justify-between items-center">
                <dt className="text-muted-foreground">{timezone}</dt>
                <dd className="font-mono truncate">
                  {format(date, "LLL dd, y HH:mm:ss")}
                </dd>
              </div>
            </dl>
          </HoverCardContent>
        </HoverCard>
      );
    },
    filterFn: "inDateRange",
    meta: {
      // headerClassName: "w-[182px]",
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const value = row.getValue("status");
      if (typeof value === "undefined") {
        return <Minus className="h-4 w-4 text-muted-foreground/50" />;
      }
      if (typeof value === "number") {
        const colors = getStatusColor(value);
        return <div className={`${colors.text} font-mono`}>{value}</div>;
      }
      return <div className="text-muted-foreground">{`${value}`}</div>;
    },
    filterFn: "arrSome",
  },
  {
    // TODO: make it a type of MethodSchema!
    accessorKey: "method",
    header: "Method",
    cell: ({ row }) => {
      const value = row.getValue("method") as string;
      return <div className="font-mono">{value}</div>;
    },
    filterFn: "arrIncludesSome",
  },
  {
    accessorKey: "host",
    header: "Host",
    cell: ({ row }) => {
      const value = row.getValue("host") as string;
      return (
        <TextWithTooltip className="font-mono max-w-[120px]" text={value} />
      );
    },
  },
  {
    accessorKey: "pathname",
    header: "Pathname",
    cell: ({ row }) => {
      const value = row.getValue("pathname") as string;
      return (
        <TextWithTooltip className="font-mono max-w-[120px]" text={value} />
      );
    },
  },
  {
    accessorKey: "latency",
    // TODO: check if we can right align the table header/cell (makes is easier to read)
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Latency" />
    ),
    cell: ({ row }) => {
      const value = row.getValue("latency") as number;
      return <LatencyDisplay value={value} />;
    },
    filterFn: "inNumberRange",
  },
  {
    accessorKey: "regions",
    header: "Region",
    cell: ({ row }) => {
      const value = row.getValue("regions");
      if (Array.isArray(value)) {
        if (value.length > 1) {
          return (
            <div className="text-muted-foreground">{value.join(", ")}</div>
          );
        } else {
          return (
            <div className="whitespace-nowrap">
              <span className="font-mono">{value}</span>{" "}
              <span className="text-muted-foreground">
                - {`${regions[value[0]]}`}
              </span>
            </div>
          );
        }
      }
      if (typeof value === "string") {
        return (
          <div className="text-muted-foreground">{`${regions[value]}`}</div>
        );
      }
      return <Minus className="h-4 w-4 text-muted-foreground/50" />;
    },
    filterFn: "arrIncludesSome",
  },
  {
    accessorKey: "timing",
    header: () => <div className="whitespace-nowrap">Timing Phases</div>,
    cell: ({ row }) => {
      const timing = {
        "timing.dns": row.getValue("timing.dns") as number,
        "timing.connection": row.getValue("timing.connection") as number,
        "timing.tls": row.getValue("timing.tls") as number,
        "timing.ttfb": row.getValue("timing.ttfb") as number,
        "timing.transfer": row.getValue("timing.transfer") as number,
      };
      const latency = row.getValue("latency") as number;
      const percentage = getTimingPercentage(timing, latency);
      // create a separate component for this
      return (
        <HoverCard openDelay={50} closeDelay={50}>
          <HoverCardTrigger
            className="opacity-70 data-[state=open]:opacity-100 hover:opacity-100"
            asChild
          >
            <div className="flex">
              {Object.entries(timing).map(([key, value]) => (
                <div
                  key={key}
                  className={cn(
                    getTimingColor(key as keyof typeof timing),
                    "h-4"
                  )}
                  style={{ width: `${(value / latency) * 100}%` }}
                />
              ))}
            </div>
          </HoverCardTrigger>
          <HoverCardContent side="bottom" className="p-2 w-auto z-10">
            <div className="flex flex-col gap-1">
              {timingPhases.map((phase) => {
                const color = getTimingColor(phase);
                const percentageValue = percentage[phase];
                return (
                  <div key={phase} className="grid grid-cols-2 gap-4 text-xs">
                    <div className="flex items-center gap-2">
                      <div className={cn(color, "h-2 w-2 rounded-full")} />
                      <div className="uppercase text-accent-foreground">
                        {getTimingLabel(phase)}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <div className="font-mono text-muted-foreground">
                        {percentageValue}
                      </div>
                      <div className="font-mono">
                        {new Intl.NumberFormat("en-US", {
                          maximumFractionDigits: 3,
                        }).format(timing[phase])}
                        <span className="text-muted-foreground">ms</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </HoverCardContent>
        </HoverCard>
      );
    },
    meta: {
      label: "Timing Phases",
    },
  },
  {
    id: "timing.dns",
    accessorFn: (row) => row["timing.dns"],
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="DNS" />
    ),
    cell: ({ row }) => {
      const value = row.getValue("timing.dns") as number;
      return <LatencyDisplay value={value} />;
    },
    filterFn: "inNumberRange",
    meta: {
      label: "DNS",
    },
  },
  {
    id: "timing.connection",
    accessorFn: (row) => row["timing.connection"],
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Connection" />
    ),
    cell: ({ row }) => {
      const value = row.getValue("timing.connection") as number;
      return <LatencyDisplay value={value} />;
    },
    filterFn: "inNumberRange",
    meta: {
      label: "Connection",
    },
  },
  {
    id: "timing.tls",
    accessorFn: (row) => row["timing.tls"],
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="TLS" />
    ),
    cell: ({ row }) => {
      const value = row.getValue("timing.tls") as number;
      return <LatencyDisplay value={value} />;
    },
    filterFn: "inNumberRange",
    meta: {
      label: "TLS",
    },
  },
  {
    id: "timing.ttfb",
    accessorFn: (row) => row["timing.ttfb"],
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="TTFB" />
    ),
    cell: ({ row }) => {
      const value = row.getValue("timing.ttfb") as number;
      return <LatencyDisplay value={value} />;
    },
    filterFn: "inNumberRange",
    meta: {
      label: "TTFB",
    },
  },
  {
    id: "timing.transfer",
    accessorFn: (row) => row["timing.transfer"],
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Transfer" />
    ),
    cell: ({ row }) => {
      const value = row.getValue("timing.transfer") as number;
      return <LatencyDisplay value={value} />;
    },
    filterFn: "inNumberRange",
    meta: {
      label: "Transfer",
    },
  },
];

function LatencyDisplay({ value }: { value: number }) {
  return (
    <div className="font-mono">
      {new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 }).format(
        value
      )}
      <span className="text-muted-foreground">ms</span>
    </div>
  );
}

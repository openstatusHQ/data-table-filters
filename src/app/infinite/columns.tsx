"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Minus } from "lucide-react";
import type { ColumnSchema } from "./schema";
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
import { TextWithTooltip } from "@/components/custom/text-with-tooltip";
import { HoverCardTimestamp } from "./_components/hover-card-timestamp";
import { LEVELS } from "@/constants/levels";
import { getLevelColor } from "@/lib/request/level";

export const columns: ColumnDef<ColumnSchema>[] = [
  {
    accessorKey: "level",
    header: "",
    cell: ({ row }) => {
      const value = row.getValue("level") as (typeof LEVELS)[number];
      return (
        <div className="flex items-center justify-center">
          <div
            className={cn("h-2.5 w-2.5 rounded-[2px]", getLevelColor(value).bg)}
          />
        </div>
      );
    },
    enableHiding: false,
    enableResizing: false,
    filterFn: "arrSome",
    size: 27,
    minSize: 27,
    maxSize: 27,
    meta: {
      headerClassName:
        "w-[--header-level-size] max-w-[--header-level-size] min-w-[--header-level-size]",
      cellClassName:
        "w-[--col-level-size] max-w-[--col-level-size] min-w-[--col-level-size]",
    },
  },
  {
    accessorKey: "date",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Date" />
    ),
    cell: ({ row }) => {
      const date = new Date(row.getValue("date"));
      return <HoverCardTimestamp date={date} />;
    },
    filterFn: "inDateRange",
    enableResizing: false,
    size: 200,
    minSize: 200,
    meta: {
      headerClassName:
        "w-[--header-date-size] max-w-[--header-date-size] min-w-[--header-date-size]",
      cellClassName:
        "font-mono w-[--col-date-size] max-w-[--col-date-size] min-w-[--col-date-size]",
    },
  },
  {
    id: "uuid",
    accessorKey: "uuid",
    header: "Request Id",
    cell: ({ row }) => {
      const value = row.getValue("uuid") as string;
      return <TextWithTooltip text={value} />;
    },
    size: 130,
    minSize: 130,
    meta: {
      label: "Request Id",
      cellClassName:
        "font-mono w-[--col-uuid-size] max-w-[--col-uuid-size] min-w-[--col-uuid-size]",
      headerClassName:
        "min-w-[--header-uuid-size] w-[--header-uuid-size] max-w-[--header-uuid-size]",
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
    enableResizing: false,
    size: 60,
    minSize: 60,
    meta: {
      headerClassName:
        "w-[--header-status-size] max-w-[--header-status-size] min-w-[--header-status-size]",
      cellClassName:
        "font-mono w-[--col-status-size] max-w-[--col-status-size] min-w-[--col-status-size]",
    },
  },
  {
    // TODO: make it a type of MethodSchema!
    accessorKey: "method",
    header: "Method",
    filterFn: "arrIncludesSome",
    enableResizing: false,
    size: 69,
    minSize: 69,
    meta: {
      cellClassName:
        "font-mono text-muted-foreground w-[--col-method-size] max-w-[--col-method-size] min-w-[--col-method-size]",
      headerClassName:
        "w-[--header-method-size] max-w-[--header-method-size] min-w-[--header-method-size]",
    },
  },
  {
    accessorKey: "host",
    header: "Host",
    cell: ({ row }) => {
      const value = row.getValue("host") as string;
      return <TextWithTooltip text={value} />;
    },
    size: 125,
    minSize: 125,
    meta: {
      cellClassName: "font-mono w-[--col-host-size] max-w-[--col-host-size]",
      headerClassName: "min-w-[--header-host-size] w-[--header-host-size]",
    },
  },
  {
    accessorKey: "pathname",
    header: "Pathname",
    cell: ({ row }) => {
      const value = row.getValue("pathname") as string;
      return <TextWithTooltip text={value} />;
    },
    size: 130,
    minSize: 130,
    meta: {
      cellClassName:
        "font-mono w-[--col-pathname-size] max-w-[--col-pathname-size]",
      headerClassName:
        "min-w-[--header-pathname-size] w-[--header-pathname-size]",
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
    enableResizing: false,
    size: 110,
    minSize: 110,
    meta: {
      headerClassName:
        "w-[--header-latency-size] max-w-[--header-latency-size] min-w-[--header-latency-size]",
      cellClassName:
        "font-mono w-[--col-latency-size] max-w-[--col-latency-size] min-w-[--col-latency-size]",
    },
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
              <span>{value}</span>{" "}
              <span className="text-muted-foreground text-xs">
                {`${regions[value[0]]}`}
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
    enableResizing: false,
    size: 163,
    minSize: 163,
    meta: {
      headerClassName:
        "w-[--header-regions-size] max-w-[--header-regions-size] min-w-[--header-regions-size]",
      cellClassName:
        "font-mono w-[--col-regions-size] max-w-[--col-regions-size] min-w-[--col-regions-size]",
    },
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
      // TODO: create a separate component for this in _components
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
          <HoverCardContent
            side="bottom"
            align="end"
            className="p-2 w-auto z-10"
          >
            <div className="flex flex-col gap-1">
              {timingPhases.map((phase) => {
                const color = getTimingColor(phase);
                const percentageValue = percentage[phase];
                return (
                  <div key={phase} className="grid grid-cols-2 gap-4 text-xs">
                    <div className="flex items-center gap-2">
                      <div className={cn(color, "h-2 w-2 rounded-full")} />
                      <div className="uppercase font-mono text-accent-foreground">
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
    enableResizing: false,
    size: 130,
    minSize: 130,
    meta: {
      label: "Timing Phases",
      headerClassName:
        "w-[--header-timing-size] max-w-[--header-timing-size] min-w-[--header-timing-size]",
      cellClassName:
        "font-mono w-[--col-timing-size] max-w-[--col-timing-size] min-w-[--col-timing-size]",
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
    enableResizing: false,
    size: 110,
    minSize: 110,
    meta: {
      label: "DNS",
      headerClassName:
        "w-[--header-timing-dns-size] max-w-[--header-timing-dns-size] min-w-[--header-timing-dns-size]",
      cellClassName:
        "font-mono w-[--col-timing-dns-size] max-w-[--col-timing-dns-size] min-w-[--col-timing-dns-size]",
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
    enableResizing: false,
    size: 110,
    minSize: 110,
    meta: {
      label: "Connection",
      headerClassName:
        "w-[--header-timing-connection-size] max-w-[--header-timing-connection-size] min-w-[--header-timing-connection-size]",
      cellClassName:
        "font-mono w-[--col-timing-connection-size] max-w-[--col-timing-connection-size] min-w-[--col-timing-connection-size]",
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
    enableResizing: false,
    size: 110,
    minSize: 110,
    meta: {
      label: "TLS",
      headerClassName:
        "w-[--header-timing-tls-size] max-w-[--header-timing-tls-size] min-w-[--header-timing-tls-size]",
      cellClassName:
        "font-mono w-[--col-timing-tls-size] max-w-[--col-timing-tls-size] min-w-[--col-timing-tls-size]",
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
    enableResizing: false,
    size: 110,
    minSize: 110,
    meta: {
      label: "TTFB",
      headerClassName:
        "w-[--header-timing-ttfb-size] max-w-[--header-timing-ttfb-size] min-w-[--header-timing-ttfb-size]",
      cellClassName:
        "font-mono w-[--col-timing-ttfb-size] max-w-[--col-timing-ttfb-size] min-w-[--col-timing-ttfb-size]",
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
    enableResizing: false,
    size: 110,
    minSize: 110,
    meta: {
      label: "Transfer",
      headerClassName:
        "w-[--header-timing-transfer-size] max-w-[--header-timing-transfer-size] min-w-[--header-timing-transfer-size]",
      cellClassName:
        "font-mono w-[--col-timing-transfer-size] max-w-[--col-timing-transfer-size] min-w-[--col-timing-transfer-size]",
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

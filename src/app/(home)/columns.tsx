"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Minus } from "lucide-react";
import type { ColumnSchema } from "./schema";
import { getStatusColor } from "@/lib/request/status-code";
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

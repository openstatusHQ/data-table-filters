"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Check, Minus, X } from "lucide-react";
import type { ColumnSchema, TimingSchema } from "./schema";
import { isArrayOfDates, isArrayOfNumbers } from "@/lib/helpers";
import { DataTableColumnHeader } from "@/_data-table/data-table-column-header";
import { format, isSameDay } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { getStatusColor } from "@/constants/status-code";
import { regions } from "@/constants/region";
import { getTimingColor } from "@/constants/timing";
import { cn } from "@/lib/utils";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

export const columns: ColumnDef<ColumnSchema>[] = [
  {
    id: "uuid",
    accessorKey: "uuid",
    enableHiding: false,
    cell: ({ row }) => {
      const value = row.getValue("uuid") as string;
      return <div className="font-mono max-w-[85px] truncate">{value}</div>;
    },
  },
  {
    accessorKey: "success",
    header: "",
    cell: ({ row }) => {
      const value = row.getValue("success");
      if (value) return <Check className="h-4 w-4 text-green-500/50" />;
      return <X className="h-4 w-4 text-destructive" />;
    },
    filterFn: (row, id, value) => {
      const rowValue = row.getValue(id);
      if (typeof value === "string") return value === String(rowValue);
      if (typeof value === "boolean") return value === rowValue;
      if (Array.isArray(value)) return value.includes(rowValue);
      return false;
    },
  },
  {
    accessorKey: "date",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Date" />
    ),
    cell: ({ row }) => {
      const value = row.getValue("date");
      return (
        <div className="font-mono" suppressHydrationWarning>
          {format(new Date(`${value}`), "LLL dd, y HH:mm")}
        </div>
      );
    },
    filterFn: (row, id, value) => {
      const rowValue = new Date(row.getValue(id));
      if (!(rowValue instanceof Date)) return false;
      if (value instanceof Date) return isSameDay(value, rowValue);
      if (Array.isArray(value) && isArrayOfDates(value)) {
        if (value.length === 1) return isSameDay(value[0], rowValue);
        else {
          const sorted = value.sort((a, b) => a.getTime() - b.getTime());
          return (
            sorted[0]?.getTime() <= rowValue.getTime() &&
            rowValue.getTime() <= sorted[1]?.getTime()
          );
        }
      }
      return false;
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
        return (
          <Badge
            variant="outline"
            className={`${colors.bg} ${colors.border} ${colors.text} font-mono`}
          >
            {value}
          </Badge>
        );
      }
      return <div className="text-muted-foreground">{`${value}`}</div>;
    },
    filterFn: (row, id, value) => {
      const rowValue = row.getValue(id) as number;
      if (typeof value === "number") return value === Number(rowValue);
      if (Array.isArray(value) && isArrayOfNumbers(value)) {
        return value.includes(rowValue);
      }
      return false;
    },
  },
  {
    accessorKey: "latency",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Latency" />
    ),
    cell: ({ row }) => {
      const value = row.getValue("latency") as number;
      if (typeof value === "undefined") {
        return <Minus className="h-4 w-4 text-muted-foreground/50" />;
      }
      return (
        <div className="font-mono">
          {new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 }).format(
            value
          )}
          <span className="text-muted-foreground">ms</span>
        </div>
      );
    },
    filterFn: (row, id, value) => {
      const rowValue = row.getValue(id) as number;
      if (typeof value === "number") return value === Number(rowValue);
      if (Array.isArray(value) && isArrayOfNumbers(value)) {
        const sorted = value.sort((a, b) => a - b);
        return sorted[0] <= rowValue && rowValue <= sorted[1];
      }
      return false;
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
            <div>
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
    filterFn: (row, id, value) => {
      const array = row.getValue(id) as string[];
      if (typeof value === "string") return array.includes(value);
      // up to the user to define either `.some` or `.every`
      if (Array.isArray(value)) return value.some((i) => array.includes(i));
      return false;
    },
  },
  {
    accessorKey: "timing",
    header: "Timing Phases",
    cell: ({ row }) => {
      const timing = row.getValue("timing") as TimingSchema;
      const latency = row.getValue("latency") as number;
      return (
        <HoverCard>
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
          <HoverCardContent side="bottom" className="p-2 w-auto">
            <div className="flex flex-col gap-1">
              {Object.entries(timing).map(([key, value]) => (
                <div
                  key={key}
                  className="flex items-center justify-between gap-4 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        getTimingColor(key as keyof typeof timing),
                        "h-2 w-2 rounded-full"
                      )}
                    />
                    <div className="uppercase text-accent-foreground">
                      {key}
                    </div>
                  </div>
                  <div className="font-mono">
                    {new Intl.NumberFormat("en-US", {
                      maximumFractionDigits: 3,
                    }).format(value)}
                    <span className="text-muted-foreground">ms</span>
                  </div>
                </div>
              ))}
            </div>
          </HoverCardContent>
        </HoverCard>
      );
    },
  },
  {
    id: "dns",
    accessorFn: (row) => row.timing.dns,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="DNS" />
    ),
    cell: ({ row }) => {
      const value = row.getValue("dns") as number;
      return (
        <div className="font-mono">
          {new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 }).format(
            value
          )}
          <span className="text-muted-foreground">ms</span>
        </div>
      );
    },
  },
  {
    id: "connection",
    accessorFn: (row) => row.timing.connection,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Connection" />
    ),
    cell: ({ row }) => {
      const value = row.getValue("connection") as number;
      return (
        <div className="font-mono">
          {new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 }).format(
            value
          )}
          <span className="text-muted-foreground">ms</span>
        </div>
      );
    },
  },
  {
    id: "tls",
    accessorFn: (row) => row.timing.tls,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="TLS" />
    ),
    cell: ({ row }) => {
      const value = row.getValue("tls") as number;
      return (
        <div className="font-mono">
          {new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 }).format(
            value
          )}
          <span className="text-muted-foreground">ms</span>
        </div>
      );
    },
  },
  {
    id: "ttfb",
    accessorFn: (row) => row.timing.ttfb,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="TTFB" />
    ),
    cell: ({ row }) => {
      const value = row.getValue("ttfb") as number;
      return (
        <div className="font-mono">
          {new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 }).format(
            value
          )}
          <span className="text-muted-foreground">ms</span>
        </div>
      );
    },
  },
  {
    id: "transfer",
    accessorFn: (row) => row.timing.transfer,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Transfer" />
    ),
    cell: ({ row }) => {
      const value = row.getValue("transfer") as number;
      return (
        <div className="font-mono">
          {new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 }).format(
            value
          )}
          <span className="text-muted-foreground">ms</span>
        </div>
      );
    },
  },
];

"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Check, Minus, X } from "lucide-react";
import type { ColumnSchema, METHODS } from "./schema";
import { isArrayOfDates, isArrayOfNumbers } from "@/lib/helpers";
import { DataTableColumnHeader } from "@/_data-table/data-table-column-header";
import { format, isSameDay } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { getStatusColor } from "@/constants/status-code";
import { regions } from "@/constants/region";
import { getTimingColor, getTimingPercentage } from "@/constants/timing";
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
      if (value) return <Check className="h-4 w-4 text-green-500/60" />;
      return <X className="h-4 w-4 text-red-500" />;
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
        <div className="font-mono whitespace-nowrap" suppressHydrationWarning>
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
    // TODO: make it a type of MethodSchema!
    accessorKey: "method",
    header: "Method",
    cell: ({ row }) => {
      const value = row.getValue("method") as string;
      return <div className="font-mono">{value}</div>;
    },
    filterFn: (row, id, value) => {
      const rowValue = row.getValue(id) as keyof typeof METHODS;
      if (typeof value === "string") return value === rowValue;
      if (Array.isArray(value)) return value.includes(rowValue);
      return false;
    },
  },
  {
    accessorKey: "host",
    header: "Host",
    cell: ({ row }) => {
      const value = row.getValue("host") as string;
      return <div className="font-mono max-w-[120px] truncate">{value}</div>;
    },
  },
  {
    accessorKey: "pathname",
    header: "Pathname",
    cell: ({ row }) => {
      const value = row.getValue("pathname") as string;
      return <div className="font-mono max-w-[120px] truncate">{value}</div>;
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
              {Object.entries(timing).map(([key, value]) => {
                const color = getTimingColor(key as keyof typeof timing);
                const percentageValue =
                  percentage[key as keyof typeof percentage];
                return (
                  <div key={key} className="grid grid-cols-2 gap-4 text-xs">
                    <div className="flex items-center gap-2">
                      <div className={cn(color, "h-2 w-2 rounded-full")} />
                      <div className="uppercase text-accent-foreground">
                        {key}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <div className="font-mono text-muted-foreground">
                        {percentageValue}
                      </div>
                      <div className="font-mono">
                        {new Intl.NumberFormat("en-US", {
                          maximumFractionDigits: 3,
                        }).format(value)}
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
    meta: {
      label: "Transfer",
    },
  },
];

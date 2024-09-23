"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Check, Minus } from "lucide-react";
import type { ColumnSchema } from "./schema";
import { isArrayOfDates, isArrayOfNumbers } from "@/_data-table/utils";
import { DataTableColumnHeader } from "@/_data-table/data-table-column-header";
import { format, isSameDay } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { getStatusColor } from "@/constants/status-code";
import { regions } from "@/constants/region";

export const columns: ColumnDef<ColumnSchema>[] = [
  {
    accessorKey: "success",
    header: "Success",
    cell: ({ row }) => {
      const value = row.getValue("success");
      if (value) return <Check className="h-4 w-4" />;
      return <Minus className="h-4 w-4 text-muted-foreground/50" />;
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
        <div className="text-xs text-muted-foreground" suppressHydrationWarning>
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
            className={`${colors.bg} ${colors.border} ${colors.text}`}
          >
            <span className="font-mono">{`${value}`}</span>
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
      const value = row.getValue("latency");
      if (typeof value === "undefined") {
        return <Minus className="h-4 w-4 text-muted-foreground/50" />;
      }
      return (
        <div>
          <span className="font-mono">{`${value}`}</span> ms
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
];

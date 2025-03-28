"use client";

import { DataTableColumnLatency } from "@/components/data-table/data-table-column/data-table-column-latency";
import { DataTableColumnLevelIndicator } from "@/components/data-table/data-table-column/data-table-column-level-indicator";
import { DataTableColumnStatusCode } from "@/components/data-table/data-table-column/data-table-column-status-code";
import { DataTableColumnTimestamp } from "@/components/data-table/data-table-column/data-table-column-timestamp";
import type { ColumnDef } from "@tanstack/react-table";
import type { ColumnType } from "./types";

export const columns: ColumnDef<ColumnType>[] = [
  {
    accessorKey: "level",
    header: "",
    cell: ({ row }) => {
      const level = row.getValue("level") as ColumnType["level"];
      return <DataTableColumnLevelIndicator value={level} />;
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
    accessorKey: "timestamp",
    header: "Date",
    cell: ({ row }) => {
      const date = new Date(row.getValue("timestamp"));
      return <DataTableColumnTimestamp date={date} />;
    },
    enableResizing: false,
    filterFn: "inDateRange",
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as ColumnType["status"];
      return <DataTableColumnStatusCode value={status} />;
    },
    enableResizing: false,
    filterFn: "arrSome",
  },
  {
    accessorKey: "method",
    header: "Method",
    enableResizing: false,
    filterFn: "arrIncludesSome",
  },
  {
    accessorKey: "url",
    header: "URL",
    enableResizing: false,
    // meta: {
    //   cellClassName: "truncate max-w-[250px]",
    // },
  },
  {
    accessorKey: "latency",
    header: "Latency",
    cell: ({ row }) => {
      const latency = row.getValue("latency") as ColumnType["latency"];
      return <DataTableColumnLatency value={latency} />;
    },
    enableResizing: false,
    filterFn: "inNumberRange",
  },
  {
    accessorKey: "region",
    header: "Region",
    enableResizing: false,
    filterFn: "arrIncludesSome",
  },
];

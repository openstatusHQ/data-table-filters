"use client";

import { TextWithTooltip } from "@/components/custom/text-with-tooltip";
import { LEVELS } from "@/constants/levels";
import { METHODS } from "@/constants/method";
import { regions } from "@/constants/region";
import {
  ARRAY_DELIMITER,
  RANGE_DELIMITER,
  SLIDER_DELIMITER,
} from "@/lib/delimiters";
import { getStatusColor } from "@/lib/request/status-code";
import { cn } from "@/lib/utils";
import type { ColumnDef } from "@tanstack/react-table";
import { Minus } from "lucide-react";
import {
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  parseAsTimestamp,
  ParserBuilder,
} from "nuqs";
import { z } from "zod";
import { HoverCardTimestamp } from "../_components/hover-card-timestamp";

export type ColumnSchema = {
  // level
  url: string;
  method: string;
  status: number;
  latency: number;
  region: string;
  timestamp: number;
  headers: string; // TODO: parse to Record<string, string>
  body: string;
};

type ColumnsSchema = (ColumnDef<ColumnSchema> & {
  zodFn?: z.Schema;
  nuqsFn?: ParserBuilder<any>;
})[];

export const columns: ColumnsSchema = [
  // TODO: level column calculated by status code
  {
    accessorKey: "timestamp",
    header: "Date",
    cell: ({ row }) => {
      const date = new Date(row.getValue("timestamp"));
      return <HoverCardTimestamp date={date} />;
    },
    filterFn: "inDateRange",
    zodFn: z
      .string()
      .transform((val) => val.split(RANGE_DELIMITER).map(Number))
      .pipe(z.coerce.date().array())
      .optional(),
    nuqsFn: parseAsArrayOf(parseAsTimestamp, RANGE_DELIMITER),
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
    zodFn: z
      .string()
      .transform((val) => val.split(ARRAY_DELIMITER))
      .pipe(z.coerce.number().array())
      .optional(),
    nuqsFn: parseAsArrayOf(parseAsInteger, ARRAY_DELIMITER),
  },
  {
    // TODO: make it a type of MethodSchema!
    accessorKey: "method",
    header: "Method",
    filterFn: "arrIncludesSome",
    zodFn: z
      .string()
      .transform((val) => val.split(ARRAY_DELIMITER))
      .pipe(z.enum(METHODS).array())
      .optional(),
    nuqsFn: parseAsArrayOf(parseAsStringLiteral(METHODS), ARRAY_DELIMITER),
  },
  {
    accessorKey: "url",
    header: "URL",
    cell: ({ row }) => {
      const value = row.getValue("url") as string;
      return <TextWithTooltip text={value} />;
    },
    zodFn: z.string().optional(),
    nuqsFn: parseAsString,
  },
  {
    accessorKey: "latency",
    header: "Latency",
    cell: ({ row }) => {
      const value = row.getValue("latency") as number;
      return <LatencyDisplay value={value} />;
    },
    filterFn: "inNumberRange",
    zodFn: z
      .string()
      .transform((val) => val.split(SLIDER_DELIMITER))
      .pipe(z.coerce.number().array().max(2))
      .optional(),
    nuqsFn: parseAsArrayOf(parseAsInteger, SLIDER_DELIMITER),
  },
  {
    accessorKey: "region",
    header: "Region",
    cell: ({ row }) => {
      const value = row.getValue("region");
      if (Array.isArray(value)) {
        if (value.length > 1) {
          return (
            <div className="text-muted-foreground">{value.join(", ")}</div>
          );
        } else {
          return (
            <div className="whitespace-nowrap">
              <span>{value}</span>{" "}
              <span className="text-xs text-muted-foreground">
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
  },
];

function LatencyDisplay({ value }: { value: number }) {
  return (
    <div className="font-mono">
      {new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 }).format(
        value,
      )}
      <span className="text-muted-foreground">ms</span>
    </div>
  );
}

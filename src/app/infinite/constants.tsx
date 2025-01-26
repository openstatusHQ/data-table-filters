"use client";

import { cn } from "@/lib/utils";
import { type ColumnSchema } from "./schema";
import type {
  DataTableFilterField,
  Option,
} from "@/components/data-table/types";
import { getStatusColor } from "@/lib/request/status-code";
import { METHODS } from "@/constants/method";
import { REGIONS } from "@/constants/region";
import { RESULTS } from "@/constants/results";
import { getResultColor, getResultLabel } from "@/lib/request/result";

// instead of filterFields, maybe just 'fields' with a filterDisabled prop?
// that way, we could have 'message' or 'headers' field with label and value as well as type!
export const filterFields = [
  {
    label: "Time Range",
    value: "date",
    type: "timerange",
    defaultOpen: true,
    commandDisabled: true,
  },
  {
    label: "Result",
    value: "result",
    type: "checkbox",
    defaultOpen: true,
    options: RESULTS.map((result) => ({ label: result, value: result })),
    component: (props: Option) => {
      // TODO: type `Option` with `options` values via Generics
      const value = props.value as (typeof RESULTS)[number];
      return (
        <div className="flex w-full items-center justify-between gap-2 max-w-28 font-mono">
          <span className="capitalize text-foreground/70 group-hover:text-accent-foreground">
            {props.label}
          </span>
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "h-2.5 w-2.5 rounded-[2px]",
                getResultColor(value).bg
              )}
            />
            <span className="text-xs text-muted-foreground/70">
              {getResultLabel(value)}
            </span>
          </div>
        </div>
      );
    },
  },
  {
    label: "Host",
    value: "host",
    type: "input",
    options: [{ label: "", value: "" }], // REMINDER: this is a placeholder to set the type in the client.tsx
  },
  {
    label: "Pathname",
    value: "pathname",
    type: "input",
    options: [{ label: "", value: "" }], // REMINDER: this is a placeholder to set the type in the client.tsx
  },
  {
    label: "Status Code",
    value: "status",
    type: "checkbox",
    options: [
      { label: "200", value: 200 },
      { label: "400", value: 400 },
      { label: "404", value: 404 },
      { label: "500", value: 500 },
    ], // REMINDER: this is a placeholder to set the type in the client.tsx
    component: (props: Option) => {
      if (typeof props.value === "boolean") return null;
      if (typeof props.value === "undefined") return null;
      if (typeof props.value === "string") return null;
      return (
        <span className={cn("font-mono", getStatusColor(props.value).text)}>
          {props.value}
        </span>
      );
    },
  },
  {
    label: "Method",
    value: "method",
    type: "checkbox",
    options: METHODS.map((region) => ({ label: region, value: region })),
    component: (props: Option) => {
      return <span className="font-mono">{props.value}</span>;
    },
  },
  {
    label: "Regions",
    value: "regions",
    type: "checkbox",
    options: REGIONS.map((region) => ({ label: region, value: region })),
    component: (props: Option) => {
      return <span className="font-mono">{props.value}</span>;
    },
  },
  {
    label: "Latency",
    value: "latency",
    type: "slider",
    min: 0,
    max: 5000,
    options: [{ label: "10", value: 10 }], // REMINDER: this is a placeholder to set the type in the client.tsx
  },
  {
    label: "DNS",
    value: "timing.dns",
    type: "slider",
    min: 0,
    max: 5000,
    options: [{ label: "10", value: 10 }], // REMINDER: this is a placeholder to set the type in the client.tsx
  },
  {
    label: "Connection",
    value: "timing.connection",
    type: "slider",
    min: 0,
    max: 5000,
    options: [{ label: "10", value: 10 }], // REMINDER: this is a placeholder to set the type in the client.tsx
  },
  {
    label: "TLS",
    value: "timing.tls",
    type: "slider",
    min: 0,
    max: 5000,
    options: [{ label: "10", value: 10 }], // REMINDER: this is a placeholder to set the type in the client.tsx
  },
  {
    label: "TTFB",
    value: "timing.ttfb",
    type: "slider",
    min: 0,
    max: 5000,
    options: [{ label: "10", value: 10 }], // REMINDER: this is a placeholder to set the type in the client.tsx
  },
  {
    label: "Transfer",
    value: "timing.transfer",
    type: "slider",
    min: 0,
    max: 5000,
    options: [{ label: "10", value: 10 }], // REMINDER: this is a placeholder to set the type in the client.tsx
  },
] satisfies DataTableFilterField<ColumnSchema>[];

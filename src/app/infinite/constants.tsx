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

// instead of filterFields, maybe just 'fieds' with a filterDisabled prop?
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
    label: "Success",
    value: "success",
    type: "checkbox",
    options: [true, false].map((bool) => ({ label: `${bool}`, value: bool })),
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
      { label: "500", value: 500 },
    ], // REMINDER: this is a placeholder to set the type in the client.tsx
    defaultOpen: true,
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

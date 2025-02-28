"use client";

import { cn } from "@/lib/utils";
import { type ColumnSchema } from "./schema";
import type {
  DataTableFilterField,
  Option,
  SheetField,
} from "@/components/data-table/types";
import { getStatusColor } from "@/lib/request/status-code";
import { METHODS } from "@/constants/method";
import { LEVELS } from "@/constants/levels";
import { getLevelColor, getLevelLabel } from "@/lib/request/level";
import { format } from "date-fns";
import { formatMilliseconds } from "@/lib/format";
import { SheetTimingPhases } from "./_components/sheet-timing-phases";
import { TabsObjectView } from "./_components/tabs-object-view";
import CopyToClipboardContainer from "@/components/custom/copy-to-clipboard-container";
import { PopoverPercentile } from "./_components/popover-percentile";
import type { LogsMeta } from "./query-options";

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
    label: "Level",
    value: "level",
    type: "checkbox",
    defaultOpen: true,
    options: LEVELS.map((level) => ({ label: level, value: level })),
    component: (props: Option) => {
      // TODO: type `Option` with `options` values via Generics
      const value = props.value as (typeof LEVELS)[number];
      return (
        <div className="flex w-full items-center justify-between gap-2 max-w-28 font-mono">
          <span className="capitalize text-foreground/70 group-hover:text-accent-foreground">
            {props.label}
          </span>
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "h-2.5 w-2.5 rounded-[2px]",
                getLevelColor(value).bg
              )}
            />
            <span className="text-xs text-muted-foreground/70">
              {getLevelLabel(value)}
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
  },
  {
    label: "Pathname",
    value: "pathname",
    type: "input",
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
    label: "Latency",
    value: "latency",
    type: "slider",
    min: 0,
    max: 5000,
  },
] satisfies DataTableFilterField<ColumnSchema>[];

export const sheetFields = [
  {
    id: "uuid",
    label: "Request ID",
    type: "readonly",
    skeletonClassName: "w-64",
  },
  {
    id: "date",
    label: "Date",
    type: "timerange",
    component: (props) => format(new Date(props.date), "LLL dd, y HH:mm:ss"),
    skeletonClassName: "w-36",
  },
  {
    id: "status",
    label: "Status",
    type: "checkbox",
    component: (props) => {
      return (
        <span className={cn("font-mono", getStatusColor(props.status).text)}>
          {props.status}
        </span>
      );
    },
    skeletonClassName: "w-12",
  },
  {
    id: "method",
    label: "Method",
    type: "checkbox",
    component: (props) => {
      return <span className="font-mono">{props.method}</span>;
    },
    skeletonClassName: "w-10",
  },
  {
    id: "host",
    label: "Host",
    type: "input",
    skeletonClassName: "w-24",
  },
  {
    id: "pathname",
    label: "Pathname",
    type: "input",
    skeletonClassName: "w-56",
  },
  {
    id: "latency",
    label: "Latency",
    type: "slider",
    component: (props) => (
      <>
        {formatMilliseconds(props.latency)}
        <span className="text-muted-foreground">ms</span>
      </>
    ),
    skeletonClassName: "w-16",
  },
  {
    id: "percentile",
    label: "Percentile",
    type: "readonly",
    component: (props) => {
      return (
        <PopoverPercentile
          data={props}
          percentiles={props.metadata?.currentPercentiles}
          filterRows={props.metadata?.filterRows as number}
          className="ml-auto"
        />
      );
    },
    skeletonClassName: "w-12",
  },
  {
    id: "headers",
    label: "Headers",
    type: "readonly",
    component: (props) => (
      // REMINDER: negative margin to make it look like the header is on the same level of the tab triggers
      <TabsObjectView data={props.headers} className="-mt-[22px]" />
    ),
    className: "flex-col items-start w-full gap-1",
  },
  {
    id: "message",
    label: "Message",
    type: "readonly",
    condition: (props) => props.message !== undefined,
    component: (props) => (
      <CopyToClipboardContainer className="rounded-md bg-destructive/30 border border-destructive/50 p-2 whitespace-pre-wrap break-all font-mono text-sm">
        {JSON.stringify(props.message, null, 2)}
      </CopyToClipboardContainer>
    ),
    className: "flex-col items-start w-full gap-1",
  },
] satisfies SheetField<ColumnSchema, LogsMeta>[];

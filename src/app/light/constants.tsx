"use client";

import { CopyToClipboardContainer } from "@/components/custom/copy-to-clipboard-container";
import { KVTabs } from "@/components/custom/kv-tabs";
import { DataTableColumnLatency } from "@/components/data-table/data-table-column/data-table-column-latency";
import { DataTableColumnLevelIndicator } from "@/components/data-table/data-table-column/data-table-column-level-indicator";
import { DataTableColumnStatusCode } from "@/components/data-table/data-table-column/data-table-column-status-code";
import type {
  DataTableFilterField,
  Option,
  SheetField,
} from "@/components/data-table/types";
import { LEVELS } from "@/constants/levels";
import { METHODS } from "@/constants/method";
import { VERCEL_EDGE_REGIONS } from "@/constants/region";
import { format } from "date-fns";
import { type ColumnType } from "./types";

export const filterFields = [
  {
    label: "Time Range",
    value: "timestamp",
    type: "timerange",
    defaultOpen: true,
    commandDisabled: true,
  },
  {
    label: "Level",
    value: "level",
    type: "checkbox",
    defaultOpen: true,
    options: LEVELS.map((level) => ({ value: level, label: level })),
  },
  {
    label: "URL",
    value: "url",
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
    label: "Region",
    value: "region",
    type: "checkbox",
    options: VERCEL_EDGE_REGIONS.map((region) => ({
      label: region,
      value: region,
    })),
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
] satisfies DataTableFilterField<ColumnType>[];

export const sheetFields = [
  {
    id: "level",
    label: "Level",
    type: "checkbox",
    component: (props) => (
      <div className="flex items-center justify-end gap-1.5">
        <span className="capitalize">{props.level}</span>
        <DataTableColumnLevelIndicator value={props.level} />
      </div>
    ),
    skeletonClassName: "w-2.5",
  },
  {
    id: "timestamp",
    label: "Timestamp",
    type: "timerange",
    // TODO: check if we can use DataTableColumnTimestamp with disabled hover card instead
    component: (props) =>
      format(new Date(props.timestamp), "LLL dd, y HH:mm:ss"),
    skeletonClassName: "w-36",
  },
  {
    id: "status",
    label: "Status",
    type: "checkbox",
    component: (props) => <DataTableColumnStatusCode value={props.status} />,
    skeletonClassName: "w-12",
  },
  {
    id: "method",
    label: "Method",
    type: "checkbox",
    skeletonClassName: "w-10",
  },
  {
    id: "url",
    label: "URL",
    type: "input",
    skeletonClassName: "w-24",
  },
  {
    id: "region",
    label: "Region",
    type: "checkbox",
    skeletonClassName: "w-12",
  },
  {
    id: "latency",
    label: "Latency",
    type: "slider",
    component: (props) => <DataTableColumnLatency value={props.latency} />,
    skeletonClassName: "w-16",
  },
  {
    id: "headers",
    label: "Headers",
    type: "readonly",
    condition: (props) => props.headers && JSON.parse(props.headers),
    component: (props) => (
      // REMINDER: negative margin to make it look like the header is on the same level of the tab triggers
      <KVTabs data={JSON.parse(props.headers)} className="-mt-[22px]" />
    ),
    className: "flex-col items-start w-full gap-1",
  },
  {
    id: "body",
    label: "Body",
    type: "readonly",
    condition: (props) => props.body !== undefined,
    component: (props) => (
      <CopyToClipboardContainer variant="default">
        {JSON.stringify(props.body, null, 2)}
      </CopyToClipboardContainer>
    ),
    className: "flex-col items-start w-full gap-1",
  },
] satisfies SheetField<ColumnType, unknown>[];

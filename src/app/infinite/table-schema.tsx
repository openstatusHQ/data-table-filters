"use client";

import { CopyToClipboardContainer } from "@/components/custom/copy-to-clipboard-container";
import { KVTabs } from "@/components/custom/kv-tabs";
import { DataTableColumnLatency } from "@/components/data-table/data-table-column/data-table-column-latency";
import { DataTableColumnLevelIndicator } from "@/components/data-table/data-table-column/data-table-column-level-indicator";
import { DataTableColumnRegion } from "@/components/data-table/data-table-column/data-table-column-region";
import { DataTableColumnStatusCode } from "@/components/data-table/data-table-column/data-table-column-status-code";
import { LEVELS } from "@/constants/levels";
import { METHODS } from "@/constants/method";
import { REGIONS } from "@/constants/region";
import { formatMilliseconds } from "@/lib/format";
import { getLevelColor, getLevelLabel } from "@/lib/request/level";
import type { TimingPhase } from "@/lib/request/timing";
import { getStatusColor } from "@/lib/request/status-code";
import { col, createTableSchema, type InferTableType } from "@/lib/table-schema";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { PopoverPercentile } from "./_components/popover-percentile";
import { SheetTimingPhases } from "./_components/sheet-timing-phases";
import type { ColumnSchema } from "./schema";
import type { LogsMeta } from "./query-options";

export const tableSchema = createTableSchema({
  level: col
    .enum(LEVELS)
    .label("Level")
    .display("custom", {
      cell: (value) => (
        <DataTableColumnLevelIndicator value={value as (typeof LEVELS)[number]} />
      ),
    })
    .filterable("checkbox", {
      options: LEVELS.map((level) => ({ label: level, value: level })),
      component: (props) => {
        const value = props.value as (typeof LEVELS)[number];
        return (
          <div className="flex w-full max-w-28 items-center justify-between gap-2 font-mono">
            <span className="capitalize text-foreground/70 group-hover:text-accent-foreground">
              {props.label}
            </span>
            <div className="flex items-center gap-2">
              <div
                className={cn("h-2.5 w-2.5 rounded-[2px]", getLevelColor(value).bg)}
              />
              <span className="text-xs text-muted-foreground/70">
                {getLevelLabel(value)}
              </span>
            </div>
          </div>
        );
      },
    })
    .defaultOpen()
    .size(27),

  date: col
    .timestamp()
    .label("Date")
    .display("timestamp")
    .defaultOpen()
    .commandDisabled()
    .size(200)
    .sortable()
    .sheet({
      component: (props) =>
        format(new Date((props as ColumnSchema).date), "LLL dd, y HH:mm:ss"),
      skeletonClassName: "w-36",
    }),

  uuid: col
    .string()
    .label("Request Id")
    .notFilterable()
    .hidden()
    .sheet({
      label: "Request ID",
      skeletonClassName: "w-64",
    }),

  status: col
    .number()
    .label("Status")
    .display("custom", {
      cell: (value) => <DataTableColumnStatusCode value={value as number} />,
    })
    .filterable("checkbox", {
      options: [
        { label: "200", value: 200 },
        { label: "400", value: 400 },
        { label: "404", value: 404 },
        { label: "500", value: 500 },
      ],
      component: (props) => {
        if (typeof props.value === "boolean") return null;
        if (typeof props.value === "undefined") return null;
        if (typeof props.value === "string") return null;
        return (
          <span className={cn("font-mono", getStatusColor(props.value).text)}>
            {props.value}
          </span>
        );
      },
    })
    .size(60)
    .sheet({
      component: (props) => {
        const row = props as ColumnSchema;
        return (
          <span className={cn("font-mono", getStatusColor(row.status).text)}>
            {row.status}
          </span>
        );
      },
      skeletonClassName: "w-12",
    }),

  method: col
    .enum(METHODS)
    .label("Method")
    .display("text")
    .filterable("checkbox", {
      options: METHODS.map((m) => ({ label: m, value: m })),
      component: (props) => (
        <span className="font-mono">{props.value}</span>
      ),
    })
    .size(69)
    .sheet({
      component: (props) => (
        <span className="font-mono">{(props as ColumnSchema).method}</span>
      ),
      skeletonClassName: "w-10",
    }),

  host: col
    .string()
    .label("Host")
    .size(125)
    .sheet({ skeletonClassName: "w-24" }),

  pathname: col
    .string()
    .label("Pathname")
    .size(130)
    .sheet({ skeletonClassName: "w-56" }),

  latency: col
    .number()
    .label("Latency")
    .display("custom", {
      cell: (value) => <DataTableColumnLatency value={value as number} />,
    })
    .filterable("slider", { min: 0, max: 5000 })
    .size(110)
    .sortable()
    .sheet({
      component: (props) => {
        const row = props as ColumnSchema;
        return (
          <>
            {formatMilliseconds(row.latency)}
            <span className="text-muted-foreground">ms</span>
          </>
        );
      },
      skeletonClassName: "w-16",
    }),

  regions: col
    .array(col.enum(REGIONS))
    .label("Regions")
    .display("custom", {
      cell: (value) => {
        const regionValues = value as (typeof REGIONS)[number][];
        if (!Array.isArray(regionValues)) return null;
        if (regionValues.length > 1) {
          return (
            <div className="text-muted-foreground">
              {regionValues.join(", ")}
            </div>
          );
        }
        return (
          <div className="whitespace-nowrap">
            <DataTableColumnRegion value={regionValues[0]} />
          </div>
        );
      },
    })
    .filterable("checkbox", {
      options: REGIONS.map((r) => ({ label: r, value: r })),
      component: (props) => (
        <span className="font-mono">{props.value}</span>
      ),
    })
    .size(163)
    .sheet({
      component: (props) => (
        <DataTableColumnRegion
          value={(props as ColumnSchema).regions[0]}
          reverse
          showFlag
        />
      ),
      skeletonClassName: "w-12",
    }),

  percentile: col
    .number()
    .optional()
    .label("Percentile")
    .notFilterable()
    .hidden()
    .sheet({
      component: (props) => {
        const row = props as ColumnSchema & {
          metadata?: { currentPercentiles: Parameters<typeof PopoverPercentile>[0]["percentiles"]; filterRows: number } & LogsMeta;
        };
        return (
          <PopoverPercentile
            data={row}
            percentiles={row.metadata?.currentPercentiles}
            filterRows={row.metadata?.filterRows as number}
            className="ml-auto"
          />
        );
      },
      skeletonClassName: "w-12",
    }),

  "timing.dns": col
    .number()
    .label("DNS")
    .filterable("slider", { min: 0, max: 5000 })
    .size(110)
    .sortable()
    .hidden()
    .sheet({
      label: "Timing Phases",
      component: (props) => {
        const row = props as ColumnSchema;
        return (
          <SheetTimingPhases
            latency={row.latency}
            timing={row as unknown as Record<TimingPhase, number>}
          />
        );
      },
      className: "flex-col items-start w-full gap-1",
    }),

  "timing.connection": col
    .number()
    .label("Connection")
    .filterable("slider", { min: 0, max: 5000 })
    .size(110)
    .sortable()
    .hidden(),

  "timing.tls": col
    .number()
    .label("TLS")
    .filterable("slider", { min: 0, max: 5000 })
    .size(110)
    .sortable()
    .hidden(),

  "timing.ttfb": col
    .number()
    .label("TTFB")
    .filterable("slider", { min: 0, max: 5000 })
    .size(110)
    .sortable()
    .hidden(),

  "timing.transfer": col
    .number()
    .label("Transfer")
    .filterable("slider", { min: 0, max: 5000 })
    .size(110)
    .sortable()
    .hidden(),

  headers: col
    .record()
    .label("Headers")
    .notFilterable()
    .hidden()
    .sheet({
      component: (props) => (
        <KVTabs
          data={(props as ColumnSchema).headers}
          className="-mt-[22px]"
        />
      ),
      className: "flex-col items-start w-full gap-1",
    }),

  message: col
    .string()
    .optional()
    .label("Message")
    .notFilterable()
    .hidden()
    .sheet({
      condition: (props) => (props as ColumnSchema).message !== undefined,
      component: (props) => (
        <CopyToClipboardContainer variant="destructive">
          {JSON.stringify((props as ColumnSchema).message, null, 2)}
        </CopyToClipboardContainer>
      ),
      className: "flex-col items-start w-full gap-1",
    }),
});

// TypeScript type inferred from schema
export type ColumnSchemaFromTable = InferTableType<typeof tableSchema.definition>;

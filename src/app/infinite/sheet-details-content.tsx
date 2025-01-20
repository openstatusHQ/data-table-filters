"use client";
import { ColumnSchema } from "./schema";
import {
  CalendarClock,
  CalendarDays,
  CalendarSearch,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Equal,
  FunctionSquare,
  Search,
  X,
} from "lucide-react";
import * as React from "react";
import CopyToClipboardContainer from "@/components/custom/copy-to-clipboard-container";
import { cn } from "@/lib/utils";
import {
  getTimingColor,
  getTimingLabel,
  getTimingPercentage,
  timingPhases,
} from "@/lib/request/timing";
import { formatCompactNumber, formatMilliseconds } from "@/lib/format";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { getStatusColor } from "@/lib/request/status-code";
import { regions } from "@/constants/region";
import { Skeleton } from "@/components/ui/skeleton";
import { Percentile, getPercentileColor } from "@/lib/request/percentile";
import { HoverCardTimestamp } from "./hover-card-timestamp";
import { filterFields } from "./constants";
import { DropdownMenuGroup } from "@radix-ui/react-dropdown-menu";
import { Table } from "@tanstack/react-table";
import { endOfDay, endOfHour, startOfDay, startOfHour } from "date-fns";

interface SheetDetailsContentProps<TData>
  extends React.HTMLAttributes<HTMLDListElement> {
  data?: ColumnSchema;
  percentiles?: Record<Percentile, number>;
  filterRows: number;
  table: Table<TData>;
}

export function SheetDetailsContent<TData>({
  data,
  percentiles,
  filterRows,
  table,
  ...props
}: SheetDetailsContentProps<TData>) {
  const [open, setOpen] = React.useState(false); // improve naming as it only opens when hovering/clicking over the percentile

  if (!data) return <SheetDetailsContentSkeleton />;

  const statusColor = getStatusColor(data.status);
  const timingPercentage = getTimingPercentage(data, data.latency);

  let percentileArray = percentiles
    ? Object.entries(percentiles).map(([percentile, latency]) => [
        parseInt(percentile),
        latency,
      ])
    : [];

  data.percentile
    ? percentileArray.push([data.percentile, data.latency])
    : null;
  percentileArray.sort((a, b) => a[0] - b[0]);

  return (
    <dl {...props}>
      <div className="flex gap-4 py-2 border-b text-sm justify-between items-center">
        <dt className="text-muted-foreground">ID</dt>
        <dd className="font-mono truncate">{data.uuid}</dd>
      </div>
      <div className="flex gap-4 py-2 border-b text-sm justify-between items-center">
        <dt className="text-muted-foreground">Success</dt>
        <dd>
          {data.success ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <X className="h-4 w-4 text-red-500" />
          )}
        </dd>
      </div>
      <RowAction
        fieldValue="date"
        value={new Date(data.date).toISOString()}
        table={table}
        className="flex gap-4 py-2 border-b text-sm justify-between items-center w-full"
      >
        <dt className="text-muted-foreground">Date</dt>
        <dd className="font-mono text-right">
          <HoverCardTimestamp date={new Date(data.date)} side="bottom" />
        </dd>
      </RowAction>
      <RowAction
        fieldValue="status"
        value={data.status}
        table={table}
        className="flex gap-4 py-2 border-b text-sm justify-between items-center w-full"
      >
        <dt className="text-muted-foreground">Status Code</dt>
        <dd>
          <Badge
            variant="outline"
            className={`${statusColor.bg} ${statusColor.border} ${statusColor.text} font-mono`}
          >
            {data.status}
          </Badge>
        </dd>
      </RowAction>
      <RowAction
        fieldValue="host"
        value={data.host}
        table={table}
        className="flex gap-4 py-2 border-b text-sm justify-between items-center w-full"
      >
        <dt className="text-muted-foreground">Host</dt>
        <dd className="font-mono truncate">{data.host}</dd>
      </RowAction>
      <RowAction
        fieldValue="pathname"
        value={data.pathname}
        table={table}
        className="flex gap-4 py-2 border-b text-sm justify-between items-center w-full"
      >
        <dt className="text-muted-foreground">Pathname</dt>
        <dd className="font-mono truncate">{data.pathname}</dd>
      </RowAction>
      <RowAction
        fieldValue="regions"
        value={data.regions[0]}
        table={table}
        className="flex gap-4 py-2 border-b text-sm justify-between items-center w-full"
      >
        <dt className="text-muted-foreground">Region</dt>
        <dd className="font-mono text-right">
          <span className="text-muted-foreground text-xs">
            {regions[data.regions[0]]}
          </span>{" "}
          {data.regions[0]}
        </dd>
      </RowAction>
      <RowAction
        fieldValue="latency"
        value={data.latency}
        table={table}
        className="flex gap-4 py-2 border-b text-sm justify-between items-center w-full"
      >
        <dt className="text-muted-foreground">Latency</dt>
        <dd className="font-mono">
          {formatMilliseconds(data.latency)}
          <span className="text-muted-foreground">ms</span>
        </dd>
      </RowAction>
      <div className="flex gap-4 py-2 border-b text-sm justify-between items-center w-full">
        <dt className="flex items-center gap-1 text-muted-foreground">
          Percentile
        </dt>
        <dd>
          <HoverCard open={open} onOpenChange={setOpen}>
            <HoverCardTrigger
              onClick={() => setOpen((prev) => !prev)}
              className="font-mono flex items-center gap-1"
            >
              <FunctionSquare
                className={cn(
                  "h-4 w-4",
                  data.percentile
                    ? getPercentileColor(data.percentile).text
                    : "text-muted-foreground"
                )}
              />
              {!data.percentile ? "N/A" : `P${Math.round(data.percentile)}`}
            </HoverCardTrigger>
            <HoverCardContent className="w-40 flex flex-col gap-2 p-2 text-xs">
              <p>
                Calculated from filtered result of{" "}
                <span className="font-medium font-mono">
                  {formatCompactNumber(filterRows)}
                </span>{" "}
                rows.
              </p>
              <div className="flex flex-col gap-0.5">
                {percentileArray.map(([key, value]) => {
                  const active =
                    data.percentile &&
                    data.percentile === key &&
                    value === data.latency;
                  return (
                    <div
                      key={`${key}-${value}`}
                      className={cn(
                        "flex items-center justify-between px-1 py-0.5 rounded-md",
                        active && data.percentile
                          ? `border ${
                              getPercentileColor(data.percentile).border
                            }`
                          : null
                      )}
                    >
                      <div
                        className={cn(
                          "font-mono",
                          !active && "text-muted-foreground"
                        )}
                      >{`P${Math.round(key)}`}</div>
                      <div className="font-mono">
                        {formatMilliseconds(Math.round(value))}
                        <span className="text-muted-foreground">ms</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </HoverCardContent>
          </HoverCard>
        </dd>
      </div>
      <div className="flex flex-col gap-2 py-2 border-b text-sm text-left">
        <dt className="text-muted-foreground">Timing Phases</dt>
        {timingPhases.map((phase) => (
          <div
            key={phase}
            className="grid grid-cols-3 gap-2 text-xs justify-between items-center"
          >
            <div className="text-muted-foreground uppercase truncate">
              {getTimingLabel(phase)}
            </div>
            <div className="flex gap-2 col-span-2">
              <div className="font-mono text-muted-foreground mr-8">
                {timingPercentage[phase]}
              </div>
              <div className="flex flex-1 gap-2 items-center justify-end">
                <div className="font-mono">
                  {formatMilliseconds(data[phase])}
                  <span className="text-muted-foreground">ms</span>
                </div>
              </div>
              <div
                className={cn(getTimingColor(phase), "h-4")}
                style={{ width: `${(data[phase] / data.latency) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      {data.message ? (
        <div className="flex flex-col gap-2 py-2 border-b text-sm text-left">
          <dt className="text-muted-foreground">Message</dt>
          <CopyToClipboardContainer className="rounded-md bg-destructive/30 border border-destructive/50 p-2 whitespace-pre-wrap break-all font-mono">
            {JSON.stringify(data.message, null, 2)}
          </CopyToClipboardContainer>
        </div>
      ) : null}
      <div className="flex flex-col gap-2 py-2 text-sm text-left">
        <dt className="text-muted-foreground">Headers</dt>
        <CopyToClipboardContainer className="rounded-md bg-muted/50 border p-2 whitespace-pre-wrap break-all font-mono">
          {JSON.stringify(data.headers, null, 2)}
        </CopyToClipboardContainer>
      </div>
    </dl>
  );
}

const skeleton = {
  ID: "h-5 w-52",
  Success: "h-5 w-5",
  Date: "h-5 w-36",
  "Status Code": "h-5 w-12",
  Host: "h-5 w-24",
  Pathname: "h-5 w-56",
  Region: "h-5 w-12",
  Latency: "h-5 w-16",
  Percentile: "h-5 w-12",
  "Timing Phases": "h-5 w-52",
  Message: "h-5 w-52",
};

export function SheetDetailsContentSkeleton() {
  return (
    <dl>
      {Object.entries(skeleton).map(([key, size]) => (
        <div
          key={key}
          className="flex gap-4 py-2 border-b text-sm justify-between items-center"
        >
          <dt className="text-muted-foreground">{key}</dt>
          <dd>
            <Skeleton className={size} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** ------------------------------- */

interface RowActionProps<TData>
  extends React.ComponentPropsWithRef<typeof DropdownMenuTrigger> {
  fieldValue: (typeof filterFields)[number]["value"];
  value: string | number;
  table: Table<TData>;
}

// FIXME: this is a temporary component
// TODO: use options based on the type of the field
// DataTableSheetRowAction in the @/components/data-table folder?
function RowAction<TData>({
  fieldValue,
  value,
  children,
  className,
  table,
  onKeyDown,
  ...props
}: RowActionProps<TData>) {
  const field = filterFields.find((field) => field.value === fieldValue);
  const column = table.getColumn(fieldValue);

  if (!field || !column) return null;

  function renderOptions() {
    if (!field) return null;
    switch (field.type) {
      case "checkbox":
        return (
          <DropdownMenuItem
            onClick={() => {
              // FIXME:
              const filterValue = column?.getFilterValue() as
                | undefined
                | Array<unknown>;
              const newValue = filterValue?.includes(value)
                ? filterValue
                : [...(filterValue || []), value];

              column?.setFilterValue(newValue);
            }}
          >
            <Search />
            Include
          </DropdownMenuItem>
        );
      case "input":
        return (
          <DropdownMenuItem onClick={() => column?.setFilterValue(value)}>
            <Search />
            Include
          </DropdownMenuItem>
        );
      case "slider":
        return (
          <DropdownMenuGroup>
            <DropdownMenuItem
              onClick={() => column?.setFilterValue([0, value])}
            >
              {/* FIXME: change icon as it is not clear */}
              <ChevronLeft />
              Less or equal than
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => column?.setFilterValue([value, 5000])}
            >
              {/* FIXME: change icon as it is not clear */}
              <ChevronRight />
              Greater or equal than
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => column?.setFilterValue([value])}>
              <Equal />
              Equal to
            </DropdownMenuItem>
          </DropdownMenuGroup>
        );
      case "timerange":
        const date = new Date(value);
        return (
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => column?.setFilterValue([date])}>
              <CalendarSearch />
              Exact timestamp
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                const start = startOfHour(date);
                const end = endOfHour(date);
                column?.setFilterValue([start, end]);
              }}
            >
              <CalendarClock />
              Same hour
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                const start = startOfDay(date);
                const end = endOfDay(date);
                column?.setFilterValue([start, end]);
              }}
            >
              <CalendarDays />
              Same day
            </DropdownMenuItem>
          </DropdownMenuGroup>
        );
      default:
        return null;
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "rounded-md ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          className
        )}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            // REMINDER: default behavior is to open the dropdown menu
            // But because we use it to navigate between rows, we need to prevent it
            // and only use "Enter" to select the option
            e.preventDefault();
          }
          onKeyDown?.(e);
        }}
        {...props}
      >
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="left">
        {renderOptions()}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => navigator.clipboard.writeText(String(value))}
        >
          <Copy />
          Copy value
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

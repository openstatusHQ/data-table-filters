"use client";
import { ColumnSchema } from "./schema";
import { Check, FunctionSquare, X } from "lucide-react";
import * as React from "react";
import CopyToClipboardContainer from "@/components/custom/copy-to-clipboard-container";
import { cn } from "@/lib/utils";
import {
  getTimingColor,
  getTimingLabel,
  getTimingPercentage,
  timingPhases,
} from "@/lib/request/timing";
import {
  formatCompactNumber,
  formatDate,
  formatMilliseconds,
} from "@/lib/format";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Badge } from "@/components/ui/badge";
import { getStatusColor } from "@/lib/request/status-code";
import { regions } from "@/constants/region";
import { Skeleton } from "@/components/ui/skeleton";
import { Percentile, getPercentileColor } from "@/lib/request/percentile";
import { HoverCardTimestamp } from "./hover-card-timestamp";

interface SheetDetailsContentProps
  extends React.HTMLAttributes<HTMLDListElement> {
  data?: ColumnSchema;
  percentiles?: Record<Percentile, number>;
  filterRows: number;
}

export function SheetDetailsContent({
  data,
  percentiles,
  filterRows,
  ...props
}: SheetDetailsContentProps) {
  const [open, setOpen] = React.useState(false);

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
      <div className="flex gap-4 py-2 border-b text-sm justify-between items-center">
        <dt className="text-muted-foreground">Date</dt>
        <dd className="font-mono text-right">
          <HoverCardTimestamp date={new Date(data.date)} side="bottom" />
        </dd>
      </div>
      <div className="flex gap-4 py-2 border-b text-sm justify-between items-center">
        <dt className="text-muted-foreground">Status Code</dt>
        <dd>
          <Badge
            variant="outline"
            className={`${statusColor.bg} ${statusColor.border} ${statusColor.text} font-mono`}
          >
            {data.status}
          </Badge>
        </dd>
      </div>
      <div className="flex gap-4 py-2 border-b text-sm justify-between items-center">
        <dt className="text-muted-foreground">Host</dt>
        <dd className="font-mono truncate">{data.host}</dd>
      </div>
      <div className="flex gap-4 py-2 border-b text-sm justify-between items-center">
        <dt className="text-muted-foreground">Pathname</dt>
        <dd className="font-mono truncate">{data.pathname}</dd>
      </div>
      <div className="flex gap-4 py-2 border-b text-sm justify-between items-center">
        <dt className="text-muted-foreground">Region</dt>
        <dd className="font-mono text-right">
          <span className="text-muted-foreground text-xs">
            {regions[data.regions[0]]}
          </span>{" "}
          {data.regions[0]}
        </dd>
      </div>
      <div className="flex gap-4 py-2 border-b text-sm justify-between items-center">
        <dt className="text-muted-foreground">Latency</dt>
        <dd className="font-mono">
          {formatMilliseconds(data.latency)}
          <span className="text-muted-foreground">ms</span>
        </dd>
      </div>
      <div className="flex gap-4 py-2 border-b text-sm justify-between items-center">
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

import { ColumnSchema } from "./schema";
import { cn } from "@/lib/utils";
import { getStatusColor } from "@/constants/status-code";
import { formatDate, formatMilliseconds } from "@/lib/format";
import { regions } from "@/constants/region";
import { getTimingColor, getTimingPercentage } from "@/constants/timing";
import { Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function SheetList({ data }: { data?: ColumnSchema }) {
  if (!data) return null;
  const statusColor = getStatusColor(data.status);
  const timingPercentage = getTimingPercentage(data.timing, data.latency);
  return (
    <dl>
      <div className="flex gap-4 py-2 border-t text-sm justify-between items-center">
        <dt className="text-muted-foreground">ID</dt>
        <dd className="font-mono truncate">{data.uuid}</dd>
      </div>
      <div className="flex gap-4 py-2 border-t text-sm justify-between items-center">
        <dt className="text-muted-foreground">Success</dt>
        <dd>
          {data.success ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <X className="h-4 w-4 text-destructive" />
          )}
        </dd>
      </div>
      <div className="flex gap-4 py-2 border-t text-sm justify-between items-center">
        <dt className="text-muted-foreground">Date</dt>
        <dd className="font-mono text-right">{formatDate(data.date)}</dd>
      </div>
      <div className="flex gap-4 py-2 border-t text-sm justify-between items-center">
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
      <div className="flex gap-4 py-2 border-t text-sm justify-between items-center">
        <dt className="text-muted-foreground">Host</dt>
        <dd className="font-mono truncate">{data.host}</dd>
      </div>
      <div className="flex gap-4 py-2 border-t text-sm justify-between items-center">
        <dt className="text-muted-foreground">Pathname</dt>
        <dd className="font-mono truncate">{data.pathname}</dd>
      </div>
      <div className="flex gap-4 py-2 border-t text-sm justify-between items-center">
        <dt className="text-muted-foreground">Region</dt>
        <dd className="font-mono text-right">
          <span className="text-muted-foreground text-xs">
            {regions[data.regions[0]]}
          </span>{" "}
          {data.regions[0]}
        </dd>
      </div>
      <div className="flex gap-4 py-2 border-t text-sm justify-between items-center">
        <dt className="text-muted-foreground">Latency</dt>
        <dd className="font-mono">{formatMilliseconds(data.latency)} ms</dd>
      </div>
      <div className="flex flex-col gap-2 py-2 border-t text-sm text-left">
        <dt className="text-muted-foreground">Timing Phases</dt>
        {Object.entries(data.timing).map(([key, value]) => (
          <div
            key={key}
            className="grid grid-cols-3 gap-2 text-xs justify-between items-center"
          >
            <div className="text-muted-foreground uppercase">{key}</div>
            <div className="flex gap-2 col-span-2">
              <div className="font-mono text-muted-foreground mr-8">
                {timingPercentage[key as keyof typeof data.timing]}
              </div>
              <div className="flex flex-1 gap-2 items-center justify-end">
                <div className="font-mono">
                  {formatMilliseconds(value)}
                  <span className="text-muted-foreground">ms</span>
                </div>
              </div>
              <div
                key={key}
                className={cn(
                  getTimingColor(key as keyof typeof data.timing),
                  "h-4"
                )}
                style={{ width: `${(value / data.latency) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      {data.message ? (
        <div className="flex flex-col gap-2 py-2 border-t text-sm text-left">
          <dt className="text-muted-foreground">Message</dt>
          <div className="rounded-md bg-destructive/30 border border-destructive/50 p-2 whitespace-pre-wrap break-all font-mono">
            {JSON.stringify(data.message, null, 2)}
          </div>
        </div>
      ) : null}
      <div className="flex flex-col gap-2 py-2 border-t text-sm text-left">
        <dt className="text-muted-foreground">Headers</dt>
        <div className="rounded-md bg-muted/50 border p-2 whitespace-pre-wrap break-all font-mono">
          {JSON.stringify(data.headers, null, 2)}
        </div>
      </div>
    </dl>
  );
}

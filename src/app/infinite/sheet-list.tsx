import { ColumnSchema } from "./schema";
import { cn } from "@/lib/utils";
import { getStatusColor } from "@/constants/status-code";
import { formatDate, formatMilliseconds } from "@/lib/format";
import { regions } from "@/constants/region";
import { getTimingColor } from "@/constants/timing";
import { Check, X } from "lucide-react";

export function SheetList({ data }: { data?: ColumnSchema }) {
  if (!data) return null;
  return (
    <dl>
      <div className="flex gap-2 py-2 border-t text-sm sm:justify-between sm:items-center">
        <dt className="text-muted-foreground">ID</dt>
        <dd className="font-mono max-w-[150px] truncate">{data.uuid}</dd>
      </div>
      <div className="flex gap-2 py-2 border-t text-sm sm:justify-between sm:items-center">
        <dt className="text-muted-foreground">Success</dt>
        <dd className="font-mono max-w-[150px] truncate">
          {data.success ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <X className="h-4 w-4 text-destructive" />
          )}
        </dd>
      </div>
      <div className="flex gap-2 py-2 border-t text-sm sm:justify-between sm:items-center">
        <dt className="text-muted-foreground">Timestamp</dt>
        <dd className="font-mono">{formatDate(data.date)}</dd>
      </div>
      <div className="flex gap-2 py-2 border-t text-sm sm:justify-between sm:items-center">
        <dt className="text-muted-foreground">Region</dt>
        <dd className="font-mono">
          <span className="text-muted-foreground text-xs">
            {regions[data.regions[0]]}
          </span>{" "}
          {data.regions[0]}
        </dd>
      </div>
      <div className="flex gap-2 py-2 border-t text-sm sm:justify-between sm:items-center">
        <dt className="text-muted-foreground">Status Code</dt>
        <dd className={cn(getStatusColor(data.status).text, "font-mono")}>
          {data.status}
        </dd>
      </div>
      <div className="flex gap-2 py-2 border-t text-sm sm:justify-between sm:items-center">
        <dt className="text-muted-foreground">Latency</dt>
        <dd className="font-mono">{formatMilliseconds(data.latency)} ms</dd>
      </div>
      <div className="flex flex-col gap-2 py-2 border-t text-sm">
        <dt className="text-muted-foreground">Timing Phases</dt>
        {Object.entries(data.timing).map(([key, value]) => (
          <div
            key={key}
            className="flex gap-2 text-xs sm:justify-between sm:items-center"
          >
            <div className="text-muted-foreground uppercase">{key}</div>
            <div className="flex flex-1 gap-2 items-center sm:justify-end">
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
        ))}
      </div>
    </dl>
  );
}

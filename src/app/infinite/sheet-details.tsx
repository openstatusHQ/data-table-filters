import { ColumnSchema } from "./schema";

export function SheetDetails({ data }: { data?: ColumnSchema }) {
  if (!data) return null;
  return (
    <div>
      <div className="flex gap-2 sm:justify-between">
        <div className="text-muted-foreground">Timestamp</div>
        <div className="font-mono">{data.date.toString()}</div>
      </div>
      <div className="flex gap-2 sm:justify-between">
        <div className="text-muted-foreground">Region</div>
        <div className="font-mono">{data.regions.join(", ")}</div>
      </div>
      <div className="flex gap-2 sm:justify-between">
        <div className="text-muted-foreground">Latency</div>
        <div className="font-mono">{data.latency}</div>
      </div>
      <div className="flex gap-2 sm:justify-between">
        <div className="text-muted-foreground">Status</div>
        <div className="font-mono">{data.status}</div>
      </div>
    </div>
  );
}

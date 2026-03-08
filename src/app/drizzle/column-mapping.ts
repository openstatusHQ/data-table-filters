import { logs } from "@/db/drizzle/schema";
import type { ColumnMapping } from "@/lib/drizzle";

/**
 * Maps tableSchema field keys to Drizzle table columns.
 * This is the only file you need to write per table.
 */
export const columnMapping = {
  level: logs.level,
  date: logs.date,
  status: logs.status,
  latency: logs.latency,
  method: logs.method,
  host: logs.host,
  pathname: logs.pathname,
  regions: logs.regions,
  "timing.dns": logs.timingDns,
  "timing.connection": logs.timingConnection,
  "timing.tls": logs.timingTls,
  "timing.ttfb": logs.timingTtfb,
  "timing.transfer": logs.timingTransfer,
} satisfies ColumnMapping;

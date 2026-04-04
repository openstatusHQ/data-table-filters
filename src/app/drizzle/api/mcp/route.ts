import { filterSchema } from "@/app/infinite/filter-schema";
import { db } from "@/db/drizzle";
import { logs } from "@/db/drizzle/schema";
import { createDrizzleHandler } from "@/lib/drizzle";
import { createTableMCPHandler } from "@/lib/mcp";
import type { SchemaDefinition } from "@/lib/store/schema";
import { columnMapping } from "../../column-mapping";
import { tableSchema } from "../../table-schema";

// Derive MCP schema from filterSchema, excluding UI-only fields
const { live, uuid, ...mcpSchema } =
  filterSchema.definition satisfies SchemaDefinition;

const drizzleHandler = createDrizzleHandler({
  db,
  table: logs,
  schema: tableSchema.definition,
  columnMapping,
  cursorColumn: "date",
  defaultSize: 40,
});

const handler = createTableMCPHandler({
  name: "data-table-drizzle",
  description:
    "Query HTTP request logs (Drizzle/Postgres) with filters for level, method, host, pathname, latency, status, regions, date range, sort, and cursor-based pagination (cursor, size, direction)",
  schema: mcpSchema,
  getData: async ({ filters }) => {
    const result = await drizzleHandler.execute(
      filters as Record<string, unknown>,
    );

    // TODO: extract response row mapping — columnMapping already defines
    // the camelCase↔dot-notation relationship, could be reused here
    type LogRow = typeof logs.$inferSelect;
    const rows = result.data.map((row) => {
      const r = row as LogRow;
      return {
        uuid: r.uuid,
        level: r.level,
        method: r.method,
        host: r.host,
        pathname: r.pathname,
        status: r.status,
        latency: r.latency,
        regions: r.regions,
        date: r.date.toISOString(),
        message: r.message ?? undefined,
        "timing.dns": r.timingDns,
        "timing.connection": r.timingConnection,
        "timing.tls": r.timingTls,
        "timing.ttfb": r.timingTtfb,
        "timing.transfer": r.timingTransfer,
      };
    });

    return { rows, total: result.filterRowCount, facets: result.facets };
  },
});

export { handler as POST, handler as GET, handler as DELETE };

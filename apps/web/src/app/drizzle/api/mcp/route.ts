import { filterSchema } from "@/app/infinite/filter-schema";
import { db } from "@/db/drizzle";
import { logs } from "@/db/drizzle/schema";
import { createDrizzleHandler } from "@dtf/registry/lib/drizzle";
import { defineFilters } from "@dtf/registry/lib/filters";
import { createTableMCPHandler } from "@dtf/registry/lib/mcp";
import type { SchemaDefinition } from "@dtf/registry/lib/store/schema";
import { columnMapping } from "../../column-mapping";
import { tableSchema } from "../../table-schema";

// Derive MCP schema from filterSchema, excluding UI-only fields
const { live, uuid, ...mcpSchema } =
  filterSchema.definition satisfies SchemaDefinition;

const drizzleHandler = createDrizzleHandler({
  db,
  table: logs,
  filters: defineFilters(tableSchema.definition),
  columnMapping,
  cursorColumn: "date",
  defaultSize: 40,
  select: {
    headers: logs.headers,
    message: logs.message,
  },
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

    // Rows arrive keyed by schema keys. Two differences from the REST payload
    // remain, both deliberate: MCP serializes `date` as an ISO string, and
    // `percentile` is REST-only (it is computed in a pass after the handler
    // returns). This used to be a copy of the REST remap that had already
    // drifted, silently omitting `headers`.
    const rows = result.data.map((row) => ({
      ...row,
      date: (row.date as Date).toISOString(),
    }));

    return { rows, total: result.filterRowCount, facets: result.facets };
  },
});

export { handler as POST, handler as GET, handler as DELETE };

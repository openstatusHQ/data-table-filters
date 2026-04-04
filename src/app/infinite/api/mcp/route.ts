import { createTableMCPHandler } from "@/lib/mcp";
import {
  filterData,
  getFacetsFromData,
  sortData,
  splitData,
} from "@/app/infinite/api/helpers";
import { filterSchema } from "@/app/infinite/filter-schema";
import { mock, mockLive } from "@/app/infinite/api/mock";
import type { SchemaDefinition } from "@/lib/store/schema";

// Derive MCP schema from filterSchema, excluding UI-only fields
const { live, uuid, ...mcpSchema } =
  filterSchema.definition satisfies SchemaDefinition;

const handler = createTableMCPHandler({
  name: "data-table-filters",
  description:
    "Query HTTP request logs with filters for level, method, host, pathname, latency, status, regions, date range, sort, and cursor-based pagination (cursor, size, direction)",
  schema: mcpSchema,
  getData: async ({ filters }) => {
    const totalData = [...mockLive, ...mock];
    const filtered = filterData(totalData, filters);
    const sorted = sortData(filtered, filters.sort ?? null);
    const paginated = splitData(sorted, {
      cursor: filters.cursor ?? null,
      size: filters.size ?? 40,
      direction: filters.direction ?? "next",
    });
    const facets = getFacetsFromData(filtered);
    const total = filtered.length;
    const rows = paginated.map((row) => ({
      ...row,
      date: row.date.toISOString(),
    }));
    return { rows, total, facets };
  },
});

export { handler as POST, handler as GET, handler as DELETE };

import { createTableMCPHandler } from "@/lib/mcp";
import {
  filterData,
  filterValues,
  getFacetsFromData,
  sortData,
} from "@/app/infinite/api/helpers";
import { filterSchema } from "@/app/infinite/filter-schema";
import { mock, mockLive } from "@/app/infinite/api/mock";
import type { SchemaDefinition } from "@/lib/store/schema";

// Pick only the filter-relevant fields from the shared filter schema,
// excluding pagination/UI concerns (sort, uuid, live, size, cursor, etc.)
const mcpSchema = Object.fromEntries(
  filterValues.map((key) => [key, filterSchema.definition[key]]),
) as SchemaDefinition;

const handler = createTableMCPHandler({
  name: "data-table-filters",
  description:
    "Query HTTP request logs with filters for level, method, host, pathname, latency, status, regions, and date range",
  schema: mcpSchema,
  getData: async ({ filters, page, pageSize }) => {
    const totalData = [...mockLive, ...mock];
    const filtered = filterData(totalData, filters);
    const sorted = sortData(filtered, null);
    const facets = getFacetsFromData(filtered);
    const total = filtered.length;
    const rows = sorted
      .slice((page - 1) * pageSize, page * pageSize)
      .map((row) => ({ ...row, date: row.date.toISOString() }));
    return { rows, total, facets };
  },
});

export { handler as POST, handler as GET, handler as DELETE };

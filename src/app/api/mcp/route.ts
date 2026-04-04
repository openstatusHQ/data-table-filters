import { LEVELS } from "@/constants/levels";
import { METHODS } from "@/constants/method";
import { REGIONS } from "@/constants/region";
import { createTableMCPHandler } from "@/lib/mcp";
import { createSchema, field } from "@/lib/store/schema";
import {
  filterData,
  getFacetsFromData,
  sortData,
} from "@/app/infinite/api/helpers";
import { mock, mockLive } from "@/app/infinite/api/mock";

const mcpSchema = createSchema({
  level: field.array(field.stringLiteral(LEVELS)),
  method: field.array(field.stringLiteral(METHODS)),
  host: field.string(),
  pathname: field.string(),
  latency: field.array(field.number()).delimiter("-"),
  status: field.array(field.number()).delimiter(","),
  regions: field.array(field.stringLiteral(REGIONS)),
  date: field.array(field.timestamp()).delimiter("-"),
});

const handler = createTableMCPHandler({
  name: "data-table-filters",
  description:
    "Query HTTP request logs with filters for level, method, host, pathname, latency, status, regions, and date range",
  schema: mcpSchema.definition,
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

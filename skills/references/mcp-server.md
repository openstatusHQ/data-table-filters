# MCP Server

**Install:** `npx shadcn@latest add https://data-table-filters.com/r/data-table-mcp.json`

## Overview

Expose any data-table-filters table as an MCP endpoint. AI agents discover the schema via `tools/list` and query data with filters, cursor-based pagination, and faceted stats via a single `query_table` tool. Stateless, serverless-compatible.

## Library Exports (`@/lib/mcp`)

| Export                    | Purpose                                                      |
| ------------------------- | ------------------------------------------------------------ |
| `createTableMCPHandler()` | Factory — returns a `(Request) => Promise<Response>` handler |
| `TableMCPConfig`          | Config type for the handler factory                          |
| `GetDataOptions`          | Input type for the `getData` callback                        |
| `GetDataResult`           | Return type for the `getData` callback                       |

Internals (not exported): `schemaToZod` (FieldConfig → Zod), `deserializeFilters` (timestamp number → Date).

## Route Setup

The recommended pattern is to derive the MCP schema from your existing `filterSchema`, excluding UI-only fields (`live`, `uuid`) via destructuring. Each table co-locates its MCP route alongside its API route.

### In-Memory Example (Infinite)

```ts
// app/infinite/api/mcp/route.ts
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
```

### Drizzle/Postgres Example

```ts
// app/drizzle/api/mcp/route.ts
import { createTableMCPHandler } from "@/lib/mcp";
import { db } from "@/db/drizzle";
import { logs } from "@/db/drizzle/schema";
import { createDrizzleHandler } from "@/lib/drizzle";
import { filterSchema } from "@/app/infinite/filter-schema";
import { columnMapping } from "../../column-mapping";
import { tableSchema } from "../../table-schema";
import type { SchemaDefinition } from "@/lib/store/schema";

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
```

Must export POST, GET, and DELETE for Streamable HTTP spec compliance.

## Config

| Option        | Type                     | Default        | Description                        |
| ------------- | ------------------------ | -------------- | ---------------------------------- |
| `schema`      | `SchemaDefinition`       | required       | BYOS field definitions             |
| `description` | `string`                 | required       | Tool description (shown to agents) |
| `getData`     | `(opts) => Promise<...>` | required       | Data source function               |
| `name`        | `string`                 | `"data-table"` | MCP server name                    |

## Tool Parameters (`query_table`)

| Parameter | Type    | Default  | Description                                           |
| --------- | ------- | -------- | ----------------------------------------------------- |
| `filters` | object? | `{}`     | Auto-generated from BYOS schema (includes pagination) |
| `format`  | enum    | `"json"` | `"json"` or `"stats"`                                 |

Pagination is handled via filter fields: `cursor` (Unix ms timestamp), `size` (rows per page, default 40), `direction` (`"prev"` or `"next"`). Sorting via `sort` (e.g. `{ id: "latency", desc: true }`).

## Schema Mapping (FieldConfig → Zod → JSON Schema)

| Field type                              | JSON Schema output                                |
| --------------------------------------- | ------------------------------------------------- |
| `field.string()`                        | `{ "type": "string" }`                            |
| `field.number()`                        | `{ "type": "number" }`                            |
| `field.boolean()`                       | `{ "type": "boolean" }`                           |
| `field.timestamp()`                     | `{ "type": "number" }` (Unix ms)                  |
| `field.stringLiteral(["a", "b"])`       | `{ "type": "string", "enum": ["a", "b"] }`        |
| `field.array(field.stringLiteral(...))` | `{ "type": "array", "items": { "enum": [...] } }` |

All filter fields are optional. Timestamps are deserialized from Unix ms to `Date` before reaching `getData`.

## Output Formats

**json** (default):

```json
{ "rows": [...], "total": 1234 }
```

**stats** (facets only, no rows):

```json
{
  "total": 1234,
  "facets": {
    "level": { "rows": [{ "value": "error", "total": 42 }], "total": 1234 }
  }
}
```

## Client Configuration

Claude Code (`.mcp.json`):

```json
{
  "mcpServers": {
    "data-table-infinite": {
      "type": "http",
      "url": "http://localhost:3000/infinite/api/mcp"
    },
    "data-table-drizzle": {
      "type": "http",
      "url": "http://localhost:3000/drizzle/api/mcp"
    }
  }
}
```

## Architecture

```
src/lib/mcp/
  types.ts          – TableMCPConfig, GetDataOptions, GetDataResult
  schema-to-zod.ts  – FieldConfig → Zod (internal)
  deserialize.ts    – timestamp number → Date (internal)
  server.ts         – createTableMCPHandler() factory
  index.ts          – Barrel exports
  __tests__/        – Unit tests for handler, schema-to-zod, deserialize

src/app/infinite/api/mcp/
  route.ts          – In-memory demo MCP route

src/app/drizzle/api/mcp/
  route.ts          – Drizzle/Postgres MCP route
```

Per-request: fresh McpServer + WebStandardStreamableHTTPServerTransport (stateless, no session tracking).

## Dependencies

- `@modelcontextprotocol/sdk` — auto-installed via registry block
- `zod` — already present from core block

## Documentation

Docs page at `src/content/docs/12-mcp.mdx` (route: `/docs/mcp`). Covers installation, route setup, config, tool parameters, schema mapping, client configuration, and architecture.

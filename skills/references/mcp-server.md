# MCP Server

**Install:** `npx shadcn@latest add https://data-table-filters.com/r/data-table-mcp.json`

## Overview

Expose any data-table-filters table as an MCP endpoint. AI agents discover the schema via `tools/list` and query data with filters, pagination, and faceted stats via a single `query_table` tool. Stateless, serverless-compatible.

## Library Exports (`@/lib/mcp`)

| Export                    | Purpose                                                     |
| ------------------------- | ----------------------------------------------------------- |
| `createTableMCPHandler()` | Factory — returns a `(Request) => Promise<Response>` handler |
| `TableMCPConfig`          | Config type for the handler factory                          |
| `GetDataOptions`          | Input type for the `getData` callback                        |
| `GetDataResult`           | Return type for the `getData` callback                       |

Internals (not exported): `schemaToZod` (FieldConfig → Zod), `deserializeFilters` (timestamp number → Date).

## Route Setup

```ts
// app/api/mcp/route.ts
import { createTableMCPHandler } from "@/lib/mcp";
import { createSchema, field } from "@/lib/store/schema";

const schema = createSchema({
  level: field.array(field.stringLiteral(["error", "warn", "info"])),
  host: field.string(),
  latency: field.array(field.number()).delimiter("-"),
  status: field.array(field.number()).delimiter(","),
  date: field.array(field.timestamp()).delimiter("-"),
});

const handler = createTableMCPHandler({
  schema: schema.definition,
  description: "Query HTTP request logs",
  getData: async ({ filters, page, pageSize }) => {
    const { rows, total } = await fetchLogs(filters, { page, pageSize });
    const facets = computeFacets(rows);
    return { rows, total, facets };
  },
});

export { handler as POST, handler as GET, handler as DELETE };
```

Must export POST, GET, and DELETE for Streamable HTTP spec compliance.

## Config

| Option        | Type                     | Default        | Description                          |
| ------------- | ------------------------ | -------------- | ------------------------------------ |
| `schema`      | `SchemaDefinition`       | required       | BYOS field definitions               |
| `description` | `string`                 | required       | Tool description (shown to agents)   |
| `getData`     | `(opts) => Promise<...>` | required       | Data source function                 |
| `name`        | `string`                 | `"data-table"` | MCP server name                      |
| `maxPageSize` | `number`                 | `500`          | Upper bound for pageSize             |

## Tool Parameters (`query_table`)

| Parameter  | Type     | Default  | Description                      |
| ---------- | -------- | -------- | -------------------------------- |
| `filters`  | object?  | `{}`     | Auto-generated from BYOS schema  |
| `page`     | integer  | `1`      | 1-indexed page number            |
| `pageSize` | integer  | `50`     | Rows per page (max: maxPageSize) |
| `format`   | enum     | `"json"` | `"json"` or `"stats"`           |

## Schema Mapping (FieldConfig → Zod → JSON Schema)

| Field type                            | JSON Schema output             |
| ------------------------------------- | ------------------------------ |
| `field.string()`                      | `{ "type": "string" }`        |
| `field.number()`                      | `{ "type": "number" }`        |
| `field.boolean()`                     | `{ "type": "boolean" }`       |
| `field.timestamp()`                   | `{ "type": "number" }` (Unix ms) |
| `field.stringLiteral(["a", "b"])`     | `{ "type": "string", "enum": ["a", "b"] }` |
| `field.array(field.stringLiteral(...))` | `{ "type": "array", "items": { "enum": [...] } }` |

All filter fields are optional. Timestamps are deserialized from Unix ms to `Date` before reaching `getData`.

## Output Formats

**json** (default):
```json
{ "rows": [...], "total": 1234, "page": 1, "pageSize": 50 }
```

**stats** (facets only, no rows):
```json
{ "total": 1234, "facets": { "level": { "rows": [{"value": "error", "total": 42}], "total": 1234 } } }
```

## Client Configuration

Claude Desktop (`~/Library/Application Support/Claude/claude_desktop_config.json`):
```json
{ "mcpServers": { "data-table": { "url": "http://localhost:3000/api/mcp" } } }
```

## Architecture

```
src/lib/mcp/
  types.ts          – TableMCPConfig, GetDataOptions, GetDataResult
  schema-to-zod.ts  – FieldConfig → Zod (internal)
  deserialize.ts    – timestamp number → Date (internal)
  server.ts         – createTableMCPHandler() factory
  index.ts          – Barrel exports
```

Per-request: fresh McpServer + WebStandardStreamableHTTPServerTransport (stateless, no session tracking).

## Dependencies

- `@modelcontextprotocol/sdk` — auto-installed via registry block
- `zod` — already present from core block

## Documentation

Docs page at `src/content/docs/12-mcp.mdx` (route: `/docs/mcp`). Covers installation, route setup, config, tool parameters, schema mapping, client configuration, and architecture.

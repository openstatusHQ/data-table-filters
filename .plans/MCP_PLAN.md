# Plan: MCP Server for data-table-filters

## Context

Make `data-table-filters` queryable by AI agents via the **Model Context Protocol (MCP)**. The existing type-safe schema system (`createSchema` / `field.*`), data pipeline (`filterData`, `sortData`, `getFacetsFromData`), and stateless API pattern are bridged into a clean MCP endpoint at `POST /api/mcp`.

---

## Key Decisions (resolved via grill session 2026-04-04)

| Decision | Resolution |
|---|---|
| JSON-RPC implementation | Use `@modelcontextprotocol/sdk` — no hand-rolled JSON-RPC |
| Tools exposed | `query_table` only — `describe_schema` dropped (redundant with `tools/list`) |
| Schema conversion | `FieldConfig → Zod` directly (`schema-to-zod.ts`), SDK converts Zod → JSON Schema for `tools/list` |
| Output formats | `json` and `stats` only — markdown/csv dropped (agents prefer structured data) |
| Formatters file | Killed — inline json/stats logic in `server.ts` (it's a ternary) |
| Deserialization | Keep `deserialize.ts` as small dedicated file (timestamp `number → Date` boundary) |
| filterData bugs | Fix in separate commit before MCP work |
| `filters` typing | Generic — `Partial<InferSchemaType<T>>` threaded from schema |
| `rows` typing | Second generic `R` with default `Record<string, unknown>` |
| `maxPageSize` | Configurable via config, default 500 |
| `description` | **Required** on `TableMCPConfig` |
| Tool name | Hardcoded `query_table` (one table per endpoint) |
| Facet types | Reuse existing `FacetMetadataSchema` types — no parallel definitions |
| HTTP methods | POST + GET + DELETE exported from route (Streamable HTTP spec-compliant) |
| Transport | Streamable HTTP (2025-03-26 spec) via SDK's `StreamableHTTPServerTransport` |
| Sessions | Stateless — no session tracking, serverless-friendly |
| Distribution | Separate optional registry block (`data-table-mcp`) |
| MCP SDK dependency | Auto-installed via block registry metadata |
| Public API | `createTableMCPHandler` + 3 types only (internals not exported) |
| Error handling | try/catch around `getData`, surface via `isError: true` |
| Testing | Unit tests for handler, schema-to-zod, and deserialization |

---

## Architecture

```
src/lib/mcp/
  types.ts          – TypeScript interfaces (generics for filters + rows)
  schema-to-zod.ts  – FieldConfig → Zod schema (internal, not exported)
  deserialize.ts    – MCP raw inputs → typed values (timestamps only)
  server.ts         – createTableMCPHandler() factory + inline format logic
  index.ts          – Barrel exports (tight public API)

src/app/api/mcp/
  route.ts          – Next.js route handler (POST + GET + DELETE)
```

---

## Types

```ts
import type { SchemaDefinition, InferSchemaType } from "@/lib/store/schema";
// Reuse existing facet types — no parallel definitions
import type { FacetMetadataSchema } from "...existing location...";

export type OutputFormat = "json" | "stats";

export interface GetDataOptions<T extends SchemaDefinition> {
  filters: Partial<InferSchemaType<T>>;
  page: number;
  pageSize: number;
}

export interface GetDataResult<R = Record<string, unknown>> {
  rows: R[];
  total: number;
  facets?: Record<string, FacetMeta>; // reuses existing facet types
}

export interface TableMCPConfig<T extends SchemaDefinition, R = Record<string, unknown>> {
  schema: T;
  getData: (options: GetDataOptions<T>) => Promise<GetDataResult<R>>;
  description: string;               // REQUIRED — agent discoverability
  name?: string;                      // serverInfo.name, default "data-table"
  maxPageSize?: number;               // default 500
}
```

---

## `schema-to-zod.ts` (internal)

Converts `FieldConfig` → Zod schema. SDK auto-converts Zod → JSON Schema for `tools/list`.

| Field type      | Zod output                                          |
| --------------- | --------------------------------------------------- |
| `string`        | `z.string().optional()`                             |
| `number`        | `z.number().optional()`                             |
| `boolean`       | `z.boolean().optional()`                            |
| `timestamp`     | `z.number().optional().describe("Unix ms")`         |
| `stringLiteral` | `z.enum(literals).optional()`                       |
| `array` of X    | `z.array(zodX).optional()`                          |

---

## `deserialize.ts` (internal)

Walks the schema and converts raw MCP JSON values to typed values. Only `timestamp` needs conversion — all other JSON primitives pass through as-is.

- `timestamp` single value: `new Date(value as number)`
- `array` of timestamps: `(value as number[]).map(ms => new Date(ms))`
- All other types: pass through

---

## `server.ts` — `createTableMCPHandler()`

Uses `@modelcontextprotocol/sdk` `McpServer` + `StreamableHTTPServerTransport`.

**Single tool: `query_table`**

```
filters    – auto-generated Zod schema from developer's schema (all optional)
page       – z.number().int().default(1)
pageSize   – z.number().int().default(50).max(config.maxPageSize ?? 500)
format     – z.enum(["json", "stats"]).default("json")
```

**Flow:** validate args (SDK handles via Zod) → deserialize filters → call `getData()` → format response (include facets if `stats`) → return

**Error handling:**

```ts
try {
  const result = await config.getData({ filters, page, pageSize });
  // return formatted result
} catch (e) {
  return { content: [{ type: "text", text: `getData failed: ${e.message}` }], isError: true };
}
```

---

## `index.ts` — Public API

```ts
export { createTableMCPHandler } from "./server";
export type { TableMCPConfig, GetDataOptions, GetDataResult } from "./types";
```

---

## Route Handler — `src/app/api/mcp/route.ts`

Exports `POST`, `GET`, and `DELETE` for Streamable HTTP spec compliance. Stateless — no session tracking.

```ts
import { LEVELS } from "@/constants/levels";
import { METHODS } from "@/constants/method";
import { REGIONS } from "@/constants/region";
import { createTableMCPHandler } from "@/lib/mcp";
import { createSchema, field } from "@/lib/store/schema";
import { filterData, getFacetsFromData, sortData } from "@/app/infinite/api/helpers";
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
  description: "Query HTTP request logs with filters for level, method, host, pathname, latency, status, regions, and date range",
  schema: mcpSchema.definition,
  getData: async ({ filters, page, pageSize }) => {
    const totalData = [...mockLive, ...mock];
    const filtered = filterData(totalData, filters);
    const sorted = sortData(filtered, undefined);
    const facets = getFacetsFromData(filtered);
    const total = filtered.length;
    const rows = sorted
      .slice((page - 1) * pageSize, page * pageSize)
      .map((row) => ({ ...row, date: row.date.toISOString() }));
    return { rows, total, facets };
  },
});

export { handler as POST, handler as GET, handler as DELETE };
// Note: actual HTTP method routing handled inside createTableMCPHandler
// via StreamableHTTPServerTransport
```

---

## Pre-requisite: filterData fixes (separate commit)

Two bugs in `src/app/infinite/api/helpers.ts`:

### 1. Missing filter cases for `host`, `method`, `pathname`

```ts
if (key === "method" && Array.isArray(filter)) {
  if (!filter.includes(row[key])) return false;
}
if (key === "host" && typeof filter === "string" && filter) {
  if (!row[key].includes(filter)) return false;
}
if (key === "pathname" && typeof filter === "string" && filter) {
  if (!row[key].includes(filter)) return false;
}
```

### 2. Early `return true` in latency/timing block

Remove the `return true` that short-circuits remaining filter checks.

---

## Testing

Unit tests for:

- **`schema-to-zod.ts`** — each field type produces correct Zod schema, round-trips through parse
- **`deserialize.ts`** — timestamp conversion, pass-through for other types, nested arrays
- **`server.ts` / handler** — full request/response cycle: initialize, tools/list, query_table with filters, stats format, error handling, pagination bounds

---

## Verification (manual)

```bash
# Initialize
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{}}}'

# List tools
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'

# Query with filters + stats
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"query_table","arguments":{"filters":{"level":["error"]},"page":1,"pageSize":5,"format":"stats"}}}'
```

Claude Desktop config:

```json
{ "mcpServers": { "data-table": { "url": "http://localhost:3000/api/mcp" } } }
```

---

## Registry Block

Shipped as `data-table-mcp` — separate optional block. Dependencies auto-installed via registry metadata:

- `@modelcontextprotocol/sdk`

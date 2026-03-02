# Plan: MCP Server for data-table-filters

## Context

Make `data-table-filters` queryable by AI agents via the **Model Context Protocol (MCP)**. The existing type-safe schema system (`createSchema` / `field.*`), data pipeline (`filterData`, `sortData`, `getFacetsFromData`), and stateless API pattern are bridged into a clean MCP endpoint at `POST /api/mcp`.

**Key decisions:**

- MCP Streamable HTTP transport (2025-03-26 spec), single Next.js API route
- Developer passes the schema they want exposed (can be a subset — no "filter vs control" magic in the library)
- Auto-generate MCP tool definitions from that schema
- `GetDataResult` has optional `facets` (matching `FacetMetadataSchema`) — developer computes over full dataset before pagination; no separate `stats` field
- Facets included in `query_table` response when `format='stats'` (no separate tool)
- `createTableMCPHandler` auto-deserializes MCP inputs by walking schema types directly — no `parse()` (which expects URL strings); only converts timestamps (`number → Date`), all other JSON primitives pass through as-is
- No new npm packages (JSON-RPC 2.0 implemented directly)
- No auth, no SSE

---

## Architecture

```
src/lib/mcp/
  types.ts          – TypeScript interfaces
  schema-bridge.ts  – SchemaDefinition → JSON Schema (for tool inputSchema)
  deserialize.ts    – MCP raw inputs → typed values (timestamps only; JSON primitives pass through)
  formatters.ts     – Response format utilities (json, stats, markdown, csv)
  server.ts         – createTableMCPHandler() factory
  index.ts          – Barrel exports

src/app/api/mcp/
  route.ts          – Next.js POST handler (demo wiring)
```

---

## File Details

### `src/lib/mcp/types.ts`

```ts
export type OutputFormat = "json" | "stats" | "markdown" | "csv";

export interface GetDataOptions {
  filters: Record<string, unknown>; // already deserialized (Dates, etc.)
  page: number; // 1-based
  pageSize: number;
}

export interface FacetRow {
  value: unknown;
  total: number;
}

export interface FacetMeta {
  rows: FacetRow[];
  total: number;
  min?: number;
  max?: number;
}

export interface GetDataResult {
  rows: Record<string, unknown>[];
  total: number;
  facets?: Record<string, FacetMeta>; // matches FacetMetadataSchema from getFacetsFromData
}

export interface TableMCPConfig {
  schema: SchemaDefinition; // filter-only schema (developer's choice)
  getData: (options: GetDataOptions) => Promise<GetDataResult>;
  name?: string;
  description?: string;
}
```

### `src/lib/mcp/schema-bridge.ts`

Converts `FieldConfig` → JSON Schema recursively.

| Field type      | JSON Schema                                                         |
| --------------- | ------------------------------------------------------------------- |
| `string`        | `{ type: 'string' }`                                                |
| `number`        | `{ type: 'number' }`                                                |
| `boolean`       | `{ type: 'boolean' }`                                               |
| `timestamp`     | `{ type: 'number', description: 'Unix timestamp in milliseconds' }` |
| `stringLiteral` | `{ type: 'string', enum: config.literals }`                         |
| `array`         | `{ type: 'array', items: <recurse itemConfig> }`                    |
| `sort`          | `{ type: 'object', properties: { id: string, desc: boolean } }`     |

### `src/lib/mcp/deserialize.ts`

Walks the schema and converts raw MCP JSON values to typed values. Does **not** use `parse()` (which expects URL search param strings). MCP sends proper JSON so values are already the correct primitive types — only `timestamp` needs conversion.

- `timestamp` single value: `new Date(value as number)`
- `array` of timestamps: `(value as number[]).map(ms => new Date(ms))`
- All other types: pass through as-is (already correct JSON primitives)

Uses `FieldConfig.type` and `FieldConfig.itemConfig` — no external dependencies.

### `src/lib/mcp/formatters.ts`

All functions signature: `(result: GetDataResult) => object`

- **`formatJson`** → `{ rows, total }`
- **`formatStats`** → `{ rows, total, facets }` — includes developer-provided facets when present (no separate stats field)
- **`formatMarkdown`** → `{ markdown, total }` — GitHub markdown table; raw rows dropped (agent has no use for them alongside the formatted string)
- **`formatCsv`** → `{ csv, total }` — CSV with header row, quoted values when needed; raw rows dropped

### `src/lib/mcp/server.ts` — `createTableMCPHandler()`

Returns `async (body: unknown) => unknown | null`.

**MCP tools exposed:**

#### `query_table`

```
filters    – auto-generated JSON Schema from developer's schema (all optional)
page       – integer, default 1
pageSize   – integer, default 50, max 500
format     – 'json' | 'stats' | 'markdown' | 'csv', default 'json'
```

Flow: validate args → deserialize filters (auto) → call `getData()` → format response

#### `describe_schema`

```
(no arguments)
```

Returns the full JSON Schema of available filter fields with types and allowed values.
**Agents should call this first** to understand what filters exist.

**JSON-RPC methods handled:**

| Method                      | Response                                        |
| --------------------------- | ----------------------------------------------- |
| `initialize`                | `{ protocolVersion, capabilities, serverInfo }` |
| `notifications/initialized` | `null` (204 No Content)                         |
| `tools/list`                | `{ tools: [query_table, describe_schema] }`     |
| `tools/call`                | Tool result or JSON-RPC error                   |
| anything else               | JSON-RPC error -32601                           |

### `src/app/api/mcp/route.ts` — Demo wiring

Creates a **filter-only schema** (excludes `sort`, `uuid`, `live`, `size`, `start`, `direction`, `cursor`), wires to the existing mock data pipeline:

```ts
import {
  filterData,
  getFacetsFromData,
  sortData,
} from "@/app/infinite/api/helpers";
import { mock, mockLive } from "@/app/infinite/api/mock";
import { LEVELS } from "@/constants/levels";
import { METHODS } from "@/constants/method";
import { REGIONS } from "@/constants/region";
import { createTableMCPHandler } from "@/lib/mcp";
import { createSchema, field } from "@/lib/store/schema";

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
  description: "Query HTTP request logs",
  schema: mcpSchema.definition,
  getData: async ({ filters, page, pageSize }) => {
    const totalData = [...mockLive, ...mock];
    const filtered = filterData(totalData, filters); // filters already typed
    const sorted = sortData(filtered, undefined);
    const facets = getFacetsFromData(filtered); // full-dataset facets
    const total = filtered.length;
    const rows = sorted
      .slice((page - 1) * pageSize, page * pageSize)
      .map((row) => ({ ...row, date: row.date.toISOString() }));
    return { rows, total, facets };
  },
});

export async function POST(req: Request) {
  const body = await req.json();
  const result = await handler(body);
  if (result === null) return new Response(null, { status: 204 });
  return Response.json(result);
}
```

---

## Protocol Flow

```
AI Agent                       POST /api/mcp
   |-- initialize           -> return capabilities
   |-- notifications/init   -> 204
   |-- tools/list           -> [query_table, describe_schema]
   |-- describe_schema      -> JSON Schema of all filter fields + allowed values
   |-- query_table({
   |     filters: { level: ["error"], latency: [100, 500] },
   |     page: 1, pageSize: 20, format: "stats"
   |   })                   -> { rows, total, facets }
```

---

## filterData fixes (pre-requisite)

Two bugs in `src/app/infinite/api/helpers.ts` must be fixed before the MCP demo will work correctly:

### 1. Missing filter cases for `host`, `method`, `pathname`

These keys are in `filterKeys` but have no `if` block — filters sent by agents are silently ignored.

Add inside the `return data.filter(...)` loop:

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

The existing latency block ends with `return true`, which short-circuits all remaining filter checks (e.g. if latency passes, `status`, `regions`, `date` are never evaluated). Remove that early return so execution falls through to subsequent filters.

```ts
// Before
if (filter.length === 1 && row[key] !== filter[0]) {
  return false;
} else if (
  filter.length === 2 &&
  (row[key] < filter[0] || row[key] > filter[1])
) {
  return false;
}
return true; // ← REMOVE THIS

// After
if (filter.length === 1 && row[key] !== filter[0]) {
  return false;
} else if (
  filter.length === 2 &&
  (row[key] < filter[0] || row[key] > filter[1])
) {
  return false;
}
// fall through to next filter
```

---

## Critical Files

| File                                                | Usage                                                                    |
| --------------------------------------------------- | ------------------------------------------------------------------------ |
| `src/lib/store/schema/types.ts`                     | `SchemaDefinition`, `FieldConfig`                                        |
| `src/lib/store/schema/field.ts`                     | Field builder reference                                                  |
| `src/app/infinite/api/helpers.ts`                   | `filterData`, `sortData`, `getFacetsFromData` — **requires fixes above** |
| `src/app/infinite/api/mock.ts`                      | `mock`, `mockLive` — demo data                                           |
| `src/constants/levels.ts`, `method.ts`, `region.ts` | Enum values for mcpSchema                                                |

---

## Verification

```bash
# Initialize
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{}}}'

# List tools
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'

# Describe schema (agent discovery)
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"describe_schema","arguments":{}}}'

# Query with filters + stats
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"query_table","arguments":{"filters":{"level":["error"]},"page":1,"pageSize":5,"format":"stats"}}}'

# Markdown output
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"query_table","arguments":{"filters":{"regions":["ams"]},"format":"markdown","pageSize":10}}}'
```

Claude Desktop config:

```json
{ "mcpServers": { "data-table": { "url": "http://localhost:3000/api/mcp" } } }
```

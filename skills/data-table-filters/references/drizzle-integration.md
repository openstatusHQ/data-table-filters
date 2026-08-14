# Drizzle Integration

**Install:** `npx shadcn@latest add https://data-table.openstatus.dev/r/data-table-drizzle.json`

Auto-installs the schema block. Requires `drizzle-orm` in the project.

## Table of Contents

- [createDrizzleHandler](#createdrizzlehandler)
- [Column Mapping](#column-mapping)
- [Example Route Handler](#example-route-handler)
- [Response Shape](#response-shape)
- [Three-Pass Filtering](#three-pass-filtering)

---

## createDrizzleHandler

### With the table schema (recommended)

```tsx
import { createDrizzleHandler } from "@/lib/drizzle";
import { defineFilters } from "@/lib/filters";

const handler = createDrizzleHandler({
  db, // Drizzle database instance
  table: logs, // Drizzle table reference
  filters: defineFilters(tableSchema.definition), // declared filter semantics
  columnMapping: {
    level: logs.level,
    date: logs.date,
    latency: logs.latency,
    "timing.dns": logs.timingDns, // Dotted keys map to flat columns
    // This mapping is also the projection: rows come back keyed by these keys,
    // so no caller ever sees `timingDns`. A filterable key missing from here
    // throws at construction instead of silently not filtering.
  },
  cursorColumn: "date", // Column for cursor pagination
  defaultSize: 40, // Page size (optional, default varies)
});
```

### When the schema is `"use client"`

Pass the serialized schema — the declaration crosses the boundary as data, so the server still
gets real filter semantics instead of untyped key lists:

```tsx
const handler = createDrizzleHandler({
  db,
  table: logs,
  filters: defineFilters(schemaJson), // tableSchema.toJSON(), committed or fetched
  columnMapping: {
    /* ... */
  },
  cursorColumn: "date",
});
```

You can also hand-write `FilterSpec[]` when neither is available:

```tsx
filters: defineFilters([
  { key: "level", type: "checkbox", kind: "enum" },
  { key: "status", type: "checkbox", kind: "number" },
  { key: "latency", type: "slider", kind: "number", min: 0, max: 5000 },
  { key: "regions", type: "checkbox", kind: "array", itemKind: "enum" },
  { key: "date", type: "timerange", kind: "timestamp" },
]);
```

Guard a hand-written list against drift with a test:

```tsx
expect(defineFilters(tableSchema.definition).specs).toEqual(filters.specs);
```

### Return Value

```tsx
const { execute, sliderKeys, facetKeys, dateKeys } = handler;

const result = await execute({
  level: ["error", "warn"], // checkbox filter
  latency: [100, 1000], // slider filter [min, max]
  date: [startTimestamp, endTimestamp], // timerange filter
  search: "query", // input filter
  sort: { id: "date", desc: true },
  cursor: 1234567890,
  direction: "next",
  size: 40,
});
```

`result.data` is keyed by **schema keys** — `"timing.dns"`, never `timingDns` — because the handler projects with `columnMapping`. Columns that belong in the payload but are never filtered or sorted go in `select`:

```tsx
createDrizzleHandler({
  /* ... */
  select: { uuid: logs.uuid, headers: logs.headers, message: logs.message },
});
```

`result.scope` gives custom aggregate SQL the resolved query context — `{ db, table, columns, where, whereWithoutSliders, range, bucketMs }` — instead of raw `SQL[]` it would have to re-derive from.

---

## Column Mapping

Maps schema keys to Drizzle table columns:

```tsx
// Schema key → Drizzle column
const columnMapping = {
  level: logs.level, // Direct mapping
  date: logs.date, // Direct mapping
  "timing.dns": logs.timingDns, // Dotted key → flat column
};
```

Every filterable schema key must have a corresponding entry in `columnMapping`.

---

## Example Route Handler

### Next.js App Router

```tsx
// app/api/data/route.ts
import { createDrizzleHandler } from "@/lib/drizzle";
import { db } from "@/db";
import { logs } from "@/db/schema";
import { tableSchema } from "../table-schema";
import SuperJSON from "superjson";

const handler = createDrizzleHandler({
  db,
  table: logs,
  schema: tableSchema.definition,
  columnMapping: {
    level: logs.level,
    date: logs.date,
    latency: logs.latency,
  },
  cursorColumn: "date",
  defaultSize: 40,
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const search = Object.fromEntries(url.searchParams);
  const result = await handler.execute(search);
  return new Response(SuperJSON.stringify(result), {
    headers: { "content-type": "application/json" },
  });
}
```

### Generic Handler

```tsx
export async function handleRequest(searchParams: Record<string, string>) {
  return handler.execute(searchParams);
}
```

---

## Response Shape

```tsx
interface DrizzleHandlerResult<TRow> {
  data: TRow[]; // Paginated rows
  facets: Record<
    string,
    {
      // Per-column facet metadata
      rows: { value: any; total: number }[];
      total: number;
      min?: number; // For slider/number columns
      max?: number;
    }
  >;
  totalRowCount: number; // All rows (no filters)
  filterRowCount: number; // Rows after filtering
  nextCursor: number | null; // Next page cursor (ms or number)
  prevCursor: number | null; // Previous page cursor
}
```

---

## Three-Pass Filtering

The handler uses a three-pass strategy for accurate facets:

1. **Pass 1 (Date only):** Apply only date range filters. Used to compute facets for non-slider columns within the date range.
2. **Pass 2 (Date + non-slider):** Apply date + checkbox/input filters. Used to compute slider min/max bounds (so slider ranges reflect current facet selection).
3. **Pass 3 (All filters):** Apply all filters including slider. Returns final paginated data.

This ensures slider min/max values stay stable relative to the current checkbox/date selection, not the slider's own position.

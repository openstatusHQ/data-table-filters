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

### With Schema (Recommended)

```tsx
import { createDrizzleHandler } from "@/lib/drizzle";

const handler = createDrizzleHandler({
  db, // Drizzle database instance
  table: logs, // Drizzle table reference
  schema: tableSchema.definition, // Auto-derives sliderKeys, facetKeys, dateKeys
  columnMapping: {
    level: logs.level,
    date: logs.date,
    latency: logs.latency,
    "timing.dns": logs.timingDns, // Dotted keys map to flat columns
  },
  cursorColumn: "date", // Column for cursor pagination
  defaultSize: 40, // Page size (optional, default varies)
});
```

### With Explicit Keys

Use when schema is `"use client"` and can't be imported server-side:

```tsx
const handler = createDrizzleHandler({
  db,
  table: logs,
  columnMapping: {
    /* ... */
  },
  cursorColumn: "date",
  sliderKeys: ["latency"],
  facetKeys: ["level", "method", "latency"],
  dateKeys: ["date"],
});
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

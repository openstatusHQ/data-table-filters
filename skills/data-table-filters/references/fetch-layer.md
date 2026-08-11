# Fetch Layer (React Query)

**Install:** `npx shadcn@latest add https://data-table.openstatus.dev/r/data-table-query.json`

Auto-installs `@tanstack/react-query` and `superjson`.

## Table of Contents

- [createDataTableQueryOptions](#createdatatablequeryoptions)
- [Response Shape](#response-shape)
- [Faceted Helpers](#faceted-helpers)
- [Full Example](#full-example)

---

## createDataTableQueryOptions

Factory that returns a function producing `useInfiniteQuery` options.

```tsx
import { createDataTableQueryOptions } from "@/lib/data-table";

const dataOptions = createDataTableQueryOptions<LogEntry, ChartMeta>({
  queryKeyPrefix: "logs", // React Query cache key prefix
  apiEndpoint: "/api/logs", // Fetch URL (relative or absolute)
  searchParamsSerializer: (search) => {
    // Serialize filter state to URL search string
    // Must exclude internal keys: uuid, live, cursor, direction
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(search)) {
      if (value != null) params.set(key, String(value));
    }
    return `?${params.toString()}`;
  },
});

// Use in component:
const query = useInfiniteQuery(dataOptions(filterState));
```

---

## Response Shape

The API endpoint must return this shape (serialized with SuperJSON):

```tsx
interface InfiniteQueryResponse<TData, TMeta> {
  data: TData[];
  meta: {
    totalRowCount: number;
    filterRowCount: number;
    chartData: { timestamp: number; [key: string]: number }[];
    facets: Record<
      string,
      {
        rows: { value: any; total: number }[];
        total: number;
        min?: number;
        max?: number;
      }
    >;
    metadata?: TMeta; // Custom metadata
  };
  prevCursor: number | null;
  nextCursor: number | null;
}
```

The `createDrizzleHandler.execute()` result matches this shape directly.

---

## Faceted Helpers

Use faceted data from the query response to power filter UIs:

```tsx
import {
  getFacetedUniqueValues,
  getFacetedMinMaxValues,
} from "@/lib/data-table/faceted";

const facets = query.data?.pages[0]?.meta.facets;

// For checkbox filters — returns Map<value, count>
const uniqueValues = getFacetedUniqueValues(facets);
// uniqueValues(table, "level") → Map { "error" → 42, "warn" → 15 }

// For slider filters — returns [min, max]
const minMaxValues = getFacetedMinMaxValues(facets);
// minMaxValues(table, "latency") → [10, 5000]
```

Pass these to `DataTableProvider`:

```tsx
<DataTableProvider
  table={table}
  getFacetedUniqueValues={getFacetedUniqueValues(facets)}
  getFacetedMinMaxValues={getFacetedMinMaxValues(facets)}
  // ...
/>
```

---

## Full Example

```tsx
"use client";
import { useInfiniteQuery } from "@tanstack/react-query";
import { DataTableInfinite } from "@/components/data-table/data-table-infinite";
import { DataTableStoreProvider } from "@/lib/store/provider/DataTableStoreProvider";
import { useNuqsAdapter } from "@/lib/store/adapters/nuqs";
import { useFilterState } from "@/lib/store/hooks/useFilterState";
import {
  getFacetedUniqueValues,
  getFacetedMinMaxValues,
} from "@/lib/data-table/faceted";
import { createDataTableQueryOptions } from "@/lib/data-table";
import {
  generateColumns,
  generateFilterFields,
  generateFilterSchema,
} from "@/lib/table-schema";
import { tableSchema, type Row } from "./table-schema";

const columns = generateColumns<Row>(tableSchema.definition);
const filterFields = generateFilterFields<Row>(tableSchema.definition);
const filterSchema = generateFilterSchema(tableSchema.definition);

const dataOptions = createDataTableQueryOptions<Row>({
  queryKeyPrefix: "my-data",
  apiEndpoint: "/api/my-data",
  searchParamsSerializer: (s) => `?${new URLSearchParams(s as any).toString()}`,
});

function InnerTable() {
  const filterState = useFilterState();
  const query = useInfiniteQuery(dataOptions(filterState));
  const data = query.data?.pages.flatMap((p) => p.data) ?? [];
  const facets = query.data?.pages[0]?.meta.facets;

  return (
    <DataTableInfinite
      columns={columns}
      data={data}
      filterFields={filterFields}
      getFacetedUniqueValues={getFacetedUniqueValues(facets)}
      getFacetedMinMaxValues={getFacetedMinMaxValues(facets)}
      isFetching={query.isFetching}
      isLoading={query.isLoading}
      fetchNextPage={query.fetchNextPage}
      hasNextPage={query.hasNextPage}
    />
  );
}

export function MyDataTable() {
  const adapter = useNuqsAdapter(filterSchema.definition, { id: "my-data" });
  return (
    <DataTableStoreProvider adapter={adapter}>
      <InnerTable />
    </DataTableStoreProvider>
  );
}
```

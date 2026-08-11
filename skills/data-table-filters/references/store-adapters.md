# Store Adapters

All adapters conform to the `StoreAdapter<T>` interface and work with `DataTableStoreProvider`.

## Table of Contents

- [Memory (Default)](#memory-default)
- [nuqs (URL State)](#nuqs-url-state)
- [zustand (Client State)](#zustand-client-state)
- [Switching Adapters](#switching-adapters)
- [Adapter Comparison](#adapter-comparison)

---

## Memory (Default)

Ships with core block. Zero config, no external deps.

```tsx
import { useMemoryAdapter } from "@/lib/store/adapters/memory";

const adapter = useMemoryAdapter(schema.definition);

<DataTableStoreProvider adapter={adapter}>
  {/* table */}
</DataTableStoreProvider>;
```

**When to use:** Prototyping, embedded components, builder interfaces, ephemeral state.

---

## nuqs (URL State)

**Install:** `npx shadcn@latest add https://data-table.openstatus.dev/r/data-table-nuqs.json`

### Hook

```tsx
import { useNuqsAdapter } from "@/lib/store/adapters/nuqs";

const adapter = useNuqsAdapter(schema.definition, {
  id: "my-table",
  shallow: true, // default: true — no page reload
  history: "push", // default: "push" — "push" | "replace"
  scroll: false, // default: false
  throttleMs: 50, // default: 50 — URL update throttle
});
```

### Server-Side Setup (Next.js)

```tsx
import { createNuqsSearchParams } from "@/lib/store/adapters/nuqs/server";

const { searchParamsCache, searchParamsSerializer } = createNuqsSearchParams(
  filterSchema.definition,
);

// In page.tsx (server component):
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const search = searchParamsCache.parse(await searchParams);
  // Prefetch with search params...
}
```

### Framework Setup (Required)

Both steps below are **required** for nuqs to work:

**1. Add `<NuqsAdapter>` to root layout** — the adapter silently fails without this.

**Next.js App Router:**

```tsx
// app/layout.tsx
import { NuqsAdapter } from "nuqs/adapters/next/app";

export default function Layout({ children }) {
  return <NuqsAdapter>{children}</NuqsAdapter>;
}
```

**Next.js Pages Router:**

```tsx
// pages/_app.tsx
import { NuqsAdapter } from "nuqs/adapters/next/pages";

export default function App({ Component, pageProps }) {
  return (
    <NuqsAdapter>
      <Component {...pageProps} />
    </NuqsAdapter>
  );
}
```

**Vite/Remix/Other:**

```tsx
import { NuqsAdapter } from "nuqs/adapters/react";
// Wrap app root
```

**2. Wrap table component in `<Suspense>`** — nuqs calls `useSearchParams()` internally, which requires a Suspense boundary in Next.js App Router (build fails without it).

```tsx
// app/page.tsx
import { Suspense } from "react";

export default function Page() {
  return (
    <Suspense>
      <MyTable />
    </Suspense>
  );
}
```

### SSR Hydration — `initialState` Pattern

When using nuqs with Next.js App Router, filters from URL params (e.g. `?status=todo`) may not apply on the initial render — causing a visible flash. This happens because `useState(defaultColumnFilters)` only reads its initial value once on the server, where nuqs returns defaults.

**Fix:** Parse search params on the server and pass them as `initialState` to the nuqs adapter.

**1. Schema** (`schema.ts`) — shared between server and client:

```tsx
import { createSchema, field } from "@/lib/store/schema";

export const filterSchema = createSchema({
  status: field
    .array(field.stringLiteral(["todo", "in-progress", "done"]))
    .default([]),
  priority: field.array(field.number()).default([]),
  title: field.string(), // Use field.string() with null default, NOT .default("")
  sort: field.sort(),
});
```

> **Important:** Use `field.string()` (null default) for input filters, not `field.string().default("")`. The empty string default causes nuqs to always return `""` instead of `null` when the param is absent, creating phantom filters.

**2. Search params** (`search-params.ts`) — server-side:

```tsx
import {
  createNuqsSearchParams,
  type inferParserType,
} from "@/lib/store/adapters/nuqs/server";
import { filterSchema } from "./schema";

export const { searchParamsParser, searchParamsCache, searchParamsSerializer } =
  createNuqsSearchParams(filterSchema.definition);

export type SearchParamsType = inferParserType<typeof searchParamsParser>;
```

**3. Server page** (`page.tsx`) — parses search params and passes to client:

```tsx
import { Suspense } from "react";
import { MyTable } from "./client";
import { searchParamsCache } from "./search-params";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[]>>;
}) {
  const search = searchParamsCache.parse(await searchParams);
  return (
    <Suspense>
      <MyTable initialState={search} />
    </Suspense>
  );
}
```

**4. Client component** (`client.tsx`) — outer/inner pattern:

```tsx
"use client";

import { useNuqsAdapter } from "@/lib/store/adapters/nuqs";
import { useFilterState } from "@/lib/store/hooks/useFilterState";
import { DataTableStoreProvider } from "@/lib/store/provider/DataTableStoreProvider";
import { filterSchema, type FilterState } from "./schema";
import type { SearchParamsType } from "./search-params";

// Outer: creates adapter seeded with server-parsed initial state
export function MyTable({ initialState }: { initialState: SearchParamsType }) {
  const adapter = useNuqsAdapter(filterSchema.definition, {
    id: "my-table",
    initialState: initialState as Partial<FilterState>,
  });

  return (
    <DataTableStoreProvider adapter={adapter}>
      <MyTableInner />
    </DataTableStoreProvider>
  );
}

// Inner: inside provider, reads BYOS state (seeded correctly from first render)
function MyTableInner() {
  const search = useFilterState<FilterState>();
  const { sort, ...filter } = search;

  const defaultColumnFilters = React.useMemo(() => {
    return Object.entries(filter)
      .map(([key, value]) => ({ id: key, value }))
      .filter(({ value }) => {
        if (value === null || value === undefined) return false;
        if (value === "") return false;
        if (Array.isArray(value) && value.length === 0) return false;
        return true;
      });
  }, [filter]);

  return (
    <DataTableInfinite
      defaultColumnFilters={defaultColumnFilters}
      defaultColumnSorting={sort ? [sort] : undefined}
      // ...other props
    />
  );
}
```

The outer/inner split is needed so `useFilterState()` runs inside `DataTableStoreProvider`.

**When to use:** User-facing tables where filter state should be in the URL (shareable links, bookmarkable filters, browser back/forward).

---

## zustand (Client State)

**Install:** `npx shadcn@latest add https://data-table.openstatus.dev/r/data-table-zustand.json`

### Create Store with Filter Slice

```tsx
import { create } from "zustand";
import { createFilterSlice } from "@/lib/store/adapters/zustand/slice";

const useAppStore = create((set, get) => ({
  // Your existing app state...
  user: null,

  // Add filter slice (namespaced by tableId)
  ...createFilterSlice(schema.definition, "my-table", set, get),
}));
```

### Hook

```tsx
import { useZustandAdapter } from "@/lib/store/adapters/zustand";

const adapter = useZustandAdapter(useAppStore, schema.definition, {
  id: "my-table",
});
```

### Multi-Table Support

```tsx
const useStore = create((set, get) => ({
  ...createFilterSlice(schema1.definition, "table-1", set, get),
  ...createFilterSlice(schema2.definition, "table-2", set, get),
}));

// Each adapter uses its own namespace
const adapter1 = useZustandAdapter(useStore, schema1.definition, {
  id: "table-1",
});
const adapter2 = useZustandAdapter(useStore, schema2.definition, {
  id: "table-2",
});
```

**When to use:** Already using zustand, complex app state, internal dashboards, no URL state needed.

---

## Switching Adapters

All adapters share the same interface. Switch by:

1. Install the new adapter block
2. Replace the hook call
3. Wrap with any required framework providers (nuqs only)

```tsx
// Before (memory):
const adapter = useMemoryAdapter(schema.definition);

// After (nuqs):
const adapter = useNuqsAdapter(schema.definition, { id: "my-table" });

// After (zustand):
const adapter = useZustandAdapter(useStore, schema.definition, {
  id: "my-table",
});
```

The `DataTableStoreProvider` and all downstream components work unchanged.

---

## Adapter Comparison

| Feature          | Memory              | nuqs                  | zustand               |
| ---------------- | ------------------- | --------------------- | --------------------- |
| **Storage**      | React refs          | URL params            | zustand store         |
| **Persistence**  | None                | URL (survives reload) | Store only            |
| **SSR**          | No                  | Full support          | No                    |
| **URL sync**     | No                  | Yes                   | No                    |
| **Multi-table**  | No                  | Yes (namespaced URLs) | Yes (namespaced keys) |
| **Dependencies** | React only          | `nuqs`                | `zustand`             |
| **Use case**     | Builders, ephemeral | Production tables     | Existing zustand apps |

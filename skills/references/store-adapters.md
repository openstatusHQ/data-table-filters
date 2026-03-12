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

**Install:** `npx shadcn@latest add https://data-table-filters.com/r/data-table-nuqs.json`

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

### Framework Setup

**Next.js App Router** — Add `<NuqsAdapter>` to root layout:

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

**When to use:** User-facing tables where filter state should be in the URL (shareable links, bookmarkable filters, browser back/forward).

---

## zustand (Client State)

**Install:** `npx shadcn@latest add https://data-table-filters.com/r/data-table-zustand.json`

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

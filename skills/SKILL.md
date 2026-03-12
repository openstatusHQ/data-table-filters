---
name: data-table-filters
description: >
  Install and extend data-table-filters — a React data table system with faceted filters
  (checkbox, input, slider, timerange), sorting, infinite scroll, virtualization, and BYOS
  state management. Delivered as 9 shadcn registry blocks installable via
  `npx shadcn@latest add`. Use when: (1) installing data-table-filters from the shadcn
  registry, (2) adding extension blocks (command palette, cell renderers, sheet panel,
  store adapters, schema system, Drizzle helpers, query layer), (3) configuring store
  adapters (nuqs/zustand/memory), (4) generating table schemas from a data model,
  (5) wiring up server-side filtering with Drizzle ORM, (6) connecting the React Query
  fetch layer, (7) troubleshooting integration issues. Triggers on mentions of
  "data-table-filters", "data-table-filters.com", filterable data tables with shadcn,
  or any of the registry block names.
---

# Data Table Filters

## Registry Blocks

All blocks install via `npx shadcn@latest add <url>`. The CLI handles dependencies, path rewriting, and CSS variable injection.

| Block                         | Install URL                                        | What it adds                                                                                   |
| ----------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **data-table**                | `https://data-table-filters.com/r/data-table.json` | Core: table engine, store, 4 filter types, memory adapter (~52 files)                          |
| **data-table-filter-command** | `.../r/data-table-filter-command.json`             | Command palette with history + keyboard shortcuts                                              |
| **data-table-cell**           | `.../r/data-table-cell.json`                       | 8 cell renderers (text, code, badge, boolean, number, status-code, level-indicator, timestamp) |
| **data-table-sheet**          | `.../r/data-table-sheet.json`                      | Row detail side panel (auto-installs cells)                                                    |
| **data-table-nuqs**           | `.../r/data-table-nuqs.json`                       | nuqs URL state adapter                                                                         |
| **data-table-zustand**        | `.../r/data-table-zustand.json`                    | zustand state adapter                                                                          |
| **data-table-schema**         | `.../r/data-table-schema.json`                     | Declarative schema system with `col.*` factories                                               |
| **data-table-drizzle**        | `.../r/data-table-drizzle.json`                    | Drizzle ORM server-side helpers (auto-installs schema)                                         |
| **data-table-query**          | `.../r/data-table-query.json`                      | React Query infinite query integration                                                         |

All URLs use base `https://data-table-filters.com`.

## Quick Start

1. Run `scripts/detect-stack.sh` to detect the user's project setup
2. Install core: `npx shadcn@latest add https://data-table-filters.com/r/data-table.json`
3. Scaffold a minimal working table (see below)
4. Extend with additional blocks as needed

### Minimal Working Table (Memory Adapter)

```tsx
"use client";
import { DataTableInfinite } from "@/components/data-table/data-table-infinite";
import { DataTableProvider } from "@/components/data-table/data-table-provider";
import type { DataTableFilterField } from "@/components/data-table/types";
import { useMemoryAdapter } from "@/lib/store/adapters/memory";
import { DataTableStoreProvider } from "@/lib/store/provider/DataTableStoreProvider";
import type { ColumnDef } from "@tanstack/react-table";

const columns: ColumnDef<YourData>[] = [
  /* user's columns */
];
const filterFields: DataTableFilterField<YourData>[] = [
  /* user's filters */
];

export function MyTable({ data }: { data: YourData[] }) {
  const adapter = useMemoryAdapter(/* schema definition */);
  return (
    <DataTableStoreProvider adapter={adapter}>
      <DataTableInfinite
        columns={columns}
        data={data}
        filterFields={filterFields}
      />
    </DataTableStoreProvider>
  );
}
```

## Wiring Extension Blocks

After installing a block via `npx shadcn@latest add`, wire it into the table.

### Command Palette → `commandSlot`

```tsx
<DataTableInfinite
  commandSlot={<DataTableFilterCommand schema={schema} tableId="my-table" />}
/>
```

### Sheet Detail Panel → `sheetSlot`

```tsx
<DataTableInfinite
  sheetSlot={
    <DataTableSheetDetails title="Details">{content}</DataTableSheetDetails>
  }
/>
```

### Cell Renderers → column definitions

```tsx
import { DataTableCellBadge } from "@/components/data-table/data-table-cell";
// Use in columnDef.cell
```

### Custom Filter Types → `FILTER_COMPONENTS`

All 4 filter types ship with core. To add custom types:

```tsx
import { FILTER_COMPONENTS } from "@/components/data-table/data-table-filter-controls";
FILTER_COMPONENTS.myCustom = MyCustomFilterComponent;
```

### All Slot Props

`DataTableInfinite` accepts: `commandSlot`, `sheetSlot`, `toolbarActions`, `chartSlot`, `footerSlot`.

See [references/component-catalog.md](references/component-catalog.md) for full wiring details.

## Store Adapter Configuration

- **memory** (default) — Ephemeral, zero config. For prototyping, embedded components, builders.
- **nuqs** — URL state. Shareable links, bookmarkable filters. Requires framework setup.
- **zustand** — Client state. For existing zustand apps, complex app state.

Install adapter block, swap in provider. See [references/store-adapters.md](references/store-adapters.md).

## Schema Generation

Install: `npx shadcn@latest add .../r/data-table-schema.json`

Map data model → `createTableSchema` + `col.*`:

- `string` → `col.string().filterable("input")`
- `number` → `col.number().filterable("slider", { min, max })`
- `boolean` → `col.boolean().filterable("checkbox")`
- `Date` → `col.timestamp().filterable("timerange")`
- `enum` → `col.enum(values).filterable("checkbox")`

Presets: `col.presets.logLevel()`, `.httpStatus()`, `.duration()`, `.timestamp()`, `.traceId()`, `.pathname()`, `.httpMethod()`.

See [references/schema-api.md](references/schema-api.md).

## Server-Side Integration

Install: `npx shadcn@latest add .../r/data-table-drizzle.json`

Scaffold route handler with `createDrizzleHandler({ db, table, columnMapping, cursorColumn, schema })`.

For non-Drizzle ORMs: implement response shape `{ data, facets, totalRowCount, filterRowCount, nextCursor, prevCursor }`.

See [references/drizzle-integration.md](references/drizzle-integration.md).

## Fetch Layer

Install: `npx shadcn@latest add .../r/data-table-query.json`

Wire `createDataTableQueryOptions({ queryKeyPrefix, apiEndpoint, searchParamsSerializer })`.

See [references/fetch-layer.md](references/fetch-layer.md).

## Troubleshooting

- **Missing CSS vars**: Core injects `--color-success/warning/error/info`. Check cssVars applied to CSS.
- **Import path mismatches**: shadcn CLI rewrites `@/` paths per `components.json` aliases.
- **nuqs framework setup**: Next.js App Router requires `<NuqsAdapter>` in root layout.
- **Filter not rendering**: Verify filter type string matches `FILTER_COMPONENTS` key.
- **Tailwind v4**: Registry targets v4. Class syntax differs from v3.

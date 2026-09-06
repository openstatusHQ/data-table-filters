# Component Catalog

All extension blocks install via `npx shadcn@latest add <url>` (base: `https://data-table.openstatus.dev`).

## Table of Contents

- [Command Palette](#command-palette)
- [Cell Renderers](#cell-renderers)
- [Sheet Detail Panel](#sheet-detail-panel)
- [Store Adapters](#store-adapters)
- [Schema System](#schema-system)
- [Drizzle Helpers](#drizzle-helpers)
- [Query Layer](#query-layer)
- [Headless Table](#headless-table)

---

## Command Palette

**Block:** `data-table-filter-command`
**Install:** `npx shadcn@latest add https://data-table.openstatus.dev/r/data-table-filter-command.json`
**Auto-resolves:** core block, shadcn `command` + `kbd` + `separator`, `date-fns`, `lucide-react`

### Props

```tsx
interface DataTableFilterCommandProps {
  schema: SchemaDefinition; // For parsing/serializing filter values
  tableId?: string; // Namespace for localStorage history
}
```

### Wiring

Pass as `commandSlot` to `DataTableInfinite`:

```tsx
import { DataTableFilterCommand } from "@/components/data-table/data-table-filter-command";

<DataTableInfinite
  commandSlot={
    <DataTableFilterCommand
      schema={filterSchema.definition}
      tableId="my-table"
    />
  }
  // ...other props
/>;
```

The command palette uses `useDataTable()` internally to access table context. No additional wiring needed.

---

## Cell Renderers

**Block:** `data-table-cell`
**Install:** `npx shadcn@latest add https://data-table.openstatus.dev/r/data-table-cell.json`
**Auto-resolves:** core block, shadcn `tooltip` + `hover-card`, `sonner`, `@date-fns/utc`

### Available Cells

| Component                     | Use for                                     |
| ----------------------------- | ------------------------------------------- |
| `DataTableCellText`           | Plain text with optional tooltip            |
| `DataTableCellCode`           | Monospace code snippets                     |
| `DataTableCellBadge`          | Colored badge labels                        |
| `DataTableCellBoolean`        | Boolean yes/no indicators                   |
| `DataTableCellNumber`         | Formatted numbers with optional unit        |
| `DataTableCellBar`            | Numbers with a proportional bar behind      |
| `DataTableCellHeatmap`        | Numbers shaded by their position in a range |
| `DataTableCellGauge`          | Numbers with a circular gauge               |
| `DataTableCellStar`           | Ratings as a filled or outlined star        |
| `DataTableCellStatusCode`     | HTTP status codes with color                |
| `DataTableCellLevelIndicator` | Log level indicators                        |
| `DataTableCellTimestamp`      | Formatted timestamps with hover detail      |

### Wiring

Import and use in column definitions:

```tsx
import {
  DataTableCellBadge,
  DataTableCellTimestamp,
} from "@/components/data-table/data-table-cell";

const columns: ColumnDef<MyData>[] = [
  {
    accessorKey: "status",
    cell: ({ row }) => <DataTableCellBadge value={row.original.status} />,
  },
];
```

---

## Sheet Detail Panel

**Block:** `data-table-sheet`
**Install:** `npx shadcn@latest add https://data-table.openstatus.dev/r/data-table-sheet.json`
**Auto-resolves:** core block + cell renderers block, shadcn `button` + `dropdown-menu` + `kbd` + `separator` + `skeleton` + `tooltip`

### Components

- `DataTableSheetDetails` — Main sheet wrapper with title
- `DataTableSheetContent` — Row content renderer (uses cell renderers)
- `DataTableSheetRowAction` — Row click action to open sheet
- `DataTableSheetSkeleton` — Loading skeleton

### Props

```tsx
interface DataTableSheetDetailsProps {
  title?: React.ReactNode;
  titleClassName?: string;
  children?: React.ReactNode;
}
```

### Wiring

Pass as `sheetSlot` to `DataTableInfinite`:

```tsx
import { DataTableSheetDetails } from "@/components/data-table/data-table-sheet/data-table-sheet-details";
import { MemoizedDataTableSheetContent } from "@/components/data-table/data-table-sheet/data-table-sheet-content";

<DataTableInfinite
  sheetSlot={
    <DataTableSheetDetails title="Request Details">
      <MemoizedDataTableSheetContent
        filterFields={filterFields}
        sheetFields={sheetFields}
      />
    </DataTableSheetDetails>
  }
/>;
```

---

## Store Adapters

See [store-adapters.md](store-adapters.md) for full setup details.

### nuqs (URL state)

**Block:** `data-table-nuqs`
**Install:** `npx shadcn@latest add https://data-table.openstatus.dev/r/data-table-nuqs.json`

### zustand (client state)

**Block:** `data-table-zustand`
**Install:** `npx shadcn@latest add https://data-table.openstatus.dev/r/data-table-zustand.json`

---

## Schema System

**Block:** `data-table-schema`
**Install:** `npx shadcn@latest add https://data-table.openstatus.dev/r/data-table-schema.json`

See [schema-api.md](schema-api.md) for full API.

---

## Drizzle Helpers

**Block:** `data-table-drizzle`
**Install:** `npx shadcn@latest add https://data-table.openstatus.dev/r/data-table-drizzle.json`

See [drizzle-integration.md](drizzle-integration.md) for handler API.

---

## Query Layer

**Block:** `data-table-query`
**Install:** `npx shadcn@latest add https://data-table.openstatus.dev/r/data-table-query.json`

See [fetch-layer.md](fetch-layer.md) for setup.

---

## Headless Table

**Block:** `data-table-remote`
**Install:** `npx shadcn@latest add https://data-table.openstatus.dev/r/data-table-remote.json`

Renders a whole table from an API endpoint's manifest — columns, filters, sheet fields, row identity and URL state — with no per-column code in the app. Requires `data-table-schema`, `data-table-query` and a store adapter.

```tsx
import { DataTableRemote } from "@/components/data-table/data-table-remote";

<DataTableRemote
  manifestEndpoint="/logs/api/schema"
  searchParamsSerializer={searchParamsSerializer}
/>;
```

| Prop                        | Purpose                                                                     |
| --------------------------- | --------------------------------------------------------------------------- |
| `manifestEndpoint`          | `GET`s a `TableManifest` (required)                                         |
| `dataEndpoint`              | Rows. Defaults to `manifestEndpoint` with a trailing `/schema` stripped     |
| `transport`                 | Base URL, headers, credentials, response parsing                            |
| `pagination`                | Cursor / opaque-cursor / offset strategy                                    |
| `initialManifest`           | Build-time snapshot or server prefetch — skips the round trip               |
| `renderers`                 | Renderer closures by column key, for what named displays cannot cover       |
| `loadingSlot` / `errorSlot` | While the manifest is in flight, and when it fails                          |
| `chartSlot`                 | `(chartData, config) => ReactNode`, only when the endpoint declares a chart |
| `sheetSlot`                 | `(sheetFields) => ReactNode`                                                |
| `getRowClassName`           | Per-row styling — presentation policy the manifest deliberately omits       |

Server side: `createTableManifest({ schema, primaryKey, rowLabel?, capabilities, chart?, actions?, defaults? })` and `createTableManifestHandler(manifest | (request) => manifest)`.

Capabilities (`facets`, `totalRowCount`, `filterRowCount`, `chart`, `backwardPagination`, `actions`) all default to **off**; the table degrades rather than rendering empty. Verify an endpoint with `runEndpointConformance({ url, manifest })`.

---

## DataTableInfinite Slot Props Reference

| Prop              | Type              | Where it renders                            |
| ----------------- | ----------------- | ------------------------------------------- |
| `commandSlot`     | `React.ReactNode` | Top bar area                                |
| `sheetSlot`       | `React.ReactNode` | After main content (overlay)                |
| `toolbarActions`  | `React.ReactNode` | Inside toolbar (extra buttons)              |
| `chartSlot`       | `React.ReactNode` | Top bar area                                |
| `footerSlot`      | `React.ReactNode` | Sidebar footer                              |
| `floatingBarSlot` | `React.ReactNode` | Fixed bar at viewport bottom (bulk actions) |

### Floating Bar (Bulk Actions)

Enable multi-row selection by adding `col.select()` to the schema. Wrap bulk action buttons in `DataTableFloatingBar` — it reads selection state from `DataTableProvider` context (same pattern as `DataTableSheetDetails` for `sheetSlot`).

```tsx
import { DataTableFloatingBar } from "@/components/data-table/data-table-floating-bar";

// In schema
const tableSchema = createTableSchema({
  select: col.select().size(37),
  // ...
});

// In client
<DataTableInfinite
  floatingBarSlot={
    <DataTableFloatingBar>
      {({ rows }) => (
        <Button variant="outline" size="sm">
          Export ({rows.length})
        </Button>
      )}
    </DataTableFloatingBar>
  }
/>;
```

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

| Component                     | Use for                                |
| ----------------------------- | -------------------------------------- |
| `DataTableCellText`           | Plain text with optional tooltip       |
| `DataTableCellCode`           | Monospace code snippets                |
| `DataTableCellBadge`          | Colored badge labels                   |
| `DataTableCellBoolean`        | Boolean yes/no indicators              |
| `DataTableCellNumber`         | Formatted numbers with optional unit   |
| `DataTableCellStatusCode`     | HTTP status codes with color           |
| `DataTableCellLevelIndicator` | Log level indicators                   |
| `DataTableCellTimestamp`      | Formatted timestamps with hover detail |

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

## DataTableInfinite Slot Props Reference

| Prop             | Type              | Where it renders               |
| ---------------- | ----------------- | ------------------------------ |
| `commandSlot`    | `React.ReactNode` | Top bar area                   |
| `sheetSlot`      | `React.ReactNode` | After main content (overlay)   |
| `toolbarActions` | `React.ReactNode` | Inside toolbar (extra buttons) |
| `chartSlot`      | `React.ReactNode` | Top bar area                   |
| `footerSlot`     | `React.ReactNode` | Sidebar footer                 |

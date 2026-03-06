## About The Project

A **Table Schema builder**, **BYOS (Bring Your Own Store)** state management, and a set of pre-built **components** for building powerful, filterable data-tables with React.

![Data Table with Infinite Scroll](https://data-table.openstatus.dev/assets/data-table-infinite.png)

Visit [data-table.openstatus.dev](https://data-table.openstatus.dev) to learn more. Read the [Guide](https://data-table.openstatus.dev/guide) for full documentation.

## Table Schema

Define your entire table — columns, filters, display, sorting, row details — in one place with `createTableSchema` and `col.*` factories.

```tsx
import {
  col,
  createTableSchema,
  type InferTableType,
} from "@/lib/table-schema";

const LEVELS = ["error", "warn", "info", "debug"] as const;

export const tableSchema = createTableSchema({
  level: col.presets.logLevel(LEVELS),
  date: col.presets.timestamp().label("Date").size(200).sheet(),
  latency: col.presets
    .duration("ms")
    .label("Latency")
    .sortable()
    .size(110)
    .sheet(),
  status: col.presets.httpStatus().label("Status").size(60),
  host: col.string().label("Host").size(125).sheet(),
});

export type ColumnSchema = InferTableType<typeof tableSchema.definition>;
```

**Generators** produce everything the table components need from a single schema:

```tsx
const columns = generateColumns<ColumnSchema>(tableSchema.definition);
const filterFields = generateFilterFields<ColumnSchema>(tableSchema.definition);
const sheetFields = generateSheetFields<ColumnSchema>(tableSchema.definition);
```

**Presets** cover common patterns: `logLevel`, `httpStatus`, `httpMethod`, `duration`, `timestamp`, `traceId`, `pathname`.

## Examples

- [`/default`](https://data-table.openstatus.dev/default) — client-side pagination (nuqs or zustand)
- [`/infinite`](https://data-table.openstatus.dev/infinite) — infinite scroll with server-side filtering, live mode, row details
- [`/light`](https://data-table.openstatus.dev/light) — OpenStatus Light Viewer (UI for [`vercel-edge-ping`](https://github.com/OpenStatusHQ/vercel-edge-ping))
- [`/builder`](https://data-table.openstatus.dev/builder) — interactive schema builder (paste JSON/CSV, live table preview, export TS)

## BYOS (Bring Your Own Store)

A pluggable adapter pattern for filter state management. Three built-in adapters:

- **nuqs** — URL-based state (shareable URLs, browser history)
- **zustand** — client-side state (existing store integration)
- **memory** — ephemeral in-memory state (embedded tables, builder)

Or implement the `StoreAdapter` interface for a custom solution. See the [Guide](https://data-table.openstatus.dev/guide) for details.

## Built With

- [nextjs](https://nextjs.org)
- [tanstack-query](https://tanstack.com/query/latest)
- [tanstack-table](https://tanstack.com/table/latest)
- [shadcn/ui](https://ui.shadcn.com)
- [cmdk](http://cmdk.paco.me)
- [nuqs](http://nuqs.47ng.com)
- [zustand](https://zustand.docs.pmnd.rs)
- [zod](https://zod.dev)
- [superjson](https://github.com/flightcontrolhq/superjson)
- [date-fns](https://date-fns.org)
- [recharts](https://recharts.org)
- [dnd-kit](https://dndkit.com)

## Getting Started

No environment variable required.

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Want more?

If you are looking for specific use-cases or like what we are building and want to hire us, feel free write us to [hire@openstatus.dev](mailto:hire@openstatus.dev) or book a call via [cal.com](https://cal.com/team/openstatus/30min).

## Credits

- [sadmann17](https://x.com/sadmann17) for the dope `<Sortable />` component around `@dnd-kit` (see [sortable.sadmn.com](https://sortable.sadmn.com))
- [shelwin\_](https://x.com/shelwin_) for the draggable chart inspiration (see [zoom-chart-demo.vercel.app](https://zoom-chart-demo.vercel.app))

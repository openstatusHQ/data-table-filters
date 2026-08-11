## About The Project

A **Table Schema builder**, **BYOS (Bring Your Own Store)** state management, and a set of pre-built **components** for building powerful, filterable data-tables with React.

![Data Table with Infinite Scroll](https://data-table.openstatus.dev/assets/data-table-infinite.png)

Visit [data-table.openstatus.dev](https://data-table.openstatus.dev) to learn more. Read the [Docs](https://data-table.openstatus.dev/docs) for full documentation.

## Install

Install blocks via the shadcn registry:

```bash
npx shadcn@latest add https://data-table.openstatus.dev/r/data-table.json
```

| Block                          | Install URL                               | What it adds                                                                                                               |
| ------------------------------ | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `data-table`                   | `.../r/data-table.json`                   | Core: table engine, store, 4 filter types, memory adapter                                                                  |
| `data-table-filter-command`    | `.../r/data-table-filter-command.json`    | Command palette with history + keyboard shortcuts                                                                          |
| `data-table-cell`              | `.../r/data-table-cell.json`              | 12 cell renderers (text, code, number, bar, heatmap, gauge, badge, boolean, star, status-code, level-indicator, timestamp) |
| `data-table-sheet`             | `.../r/data-table-sheet.json`             | Row detail side panel                                                                                                      |
| `data-table-nuqs`              | `.../r/data-table-nuqs.json`              | nuqs URL state adapter                                                                                                     |
| `data-table-zustand`           | `.../r/data-table-zustand.json`           | zustand state adapter                                                                                                      |
| `data-table-schema`            | `.../r/data-table-schema.json`            | Declarative schema system with `col.*` factories                                                                           |
| `data-table-drizzle`           | `.../r/data-table-drizzle.json`           | Drizzle ORM server-side helpers                                                                                            |
| `data-table-query`             | `.../r/data-table-query.json`             | React Query infinite query integration                                                                                     |
| `data-table-filter-command-ai` | `.../r/data-table-filter-command-ai.json` | AI-powered natural language → filter inference                                                                             |
| `data-table-mcp`               | `.../r/data-table-mcp.json`               | MCP server endpoint for AI agents                                                                                          |

All URLs use base `https://data-table.openstatus.dev`.

## For AI Agents

Install the plugin in Claude Code:

```bash
/plugin marketplace add openstatushq/data-table-filters
/plugin install data-table-filters@openstatus
```

Or install the skill with any agent that supports the `skills` CLI:

```bash
npx skills add https://github.com/openstatushq/data-table-filters --skill data-table-filters
```

Then just say "add a filterable data table" — the skill detects your stack, installs the right blocks, generates a schema, and wires everything up.

Or point any MCP client at the docs and let the agent ask them questions —
`search_docs`, `get_doc`, `list_blocks`, `get_install_plan`:

```bash
claude mcp add --transport http data-table-filters https://data-table.openstatus.dev/api/mcp
```

Machine-readable docs, for agents without the skill:

| Endpoint                                                            | What it is                                           |
| ------------------------------------------------------------------- | ---------------------------------------------------- |
| [`/api/mcp`](https://data-table.openstatus.dev/api/mcp)             | These docs as an MCP server (Streamable HTTP)        |
| [`/llms.txt`](https://data-table.openstatus.dev/llms.txt)           | Index: blocks, install recipes, docs links           |
| [`/llms-full.txt`](https://data-table.openstatus.dev/llms-full.txt) | Every documentation page in one file                 |
| [`/r/index.md`](https://data-table.openstatus.dev/r/index.md)       | Block catalog with install commands and dependencies |
| `/docs/<page>.md`                                                   | Any docs page as raw markdown                        |

Cursor users can copy [`.cursor/rules/data-table-filters.mdc`](./.cursor/rules/data-table-filters.mdc) into their project; [`AGENTS.md`](./AGENTS.md) covers every other agent. See the [For AI Agents](https://data-table.openstatus.dev/docs/agents) docs page for the full rundown.

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
- [`/drizzle`](https://data-table.openstatus.dev/drizzle) — Drizzle ORM + Supabase PostgreSQL with cursor-based pagination, faceted search, and live data via Vercel cron
- [`/light`](https://data-table.openstatus.dev/light) — OpenStatus Light Viewer (UI for [`vercel-edge-ping`](https://github.com/OpenStatusHQ/vercel-edge-ping))
- [`/builder`](https://data-table.openstatus.dev/builder) — interactive schema builder (paste JSON/CSV, live table preview, export TS)

## BYOS (Bring Your Own Store)

A pluggable adapter pattern for filter state management. Three built-in adapters:

- **nuqs** — URL-based state (shareable URLs, browser history)
- **zustand** — client-side state (existing store integration)
- **memory** — ephemeral in-memory state (embedded tables, builder)

Or implement the `StoreAdapter` interface for a custom solution. See the [Docs](https://data-table.openstatus.dev/docs) for details.

## Built With

- [nextjs](https://nextjs.org)
- [tanstack-query](https://tanstack.com/query/latest)
- [tanstack-table](https://tanstack.com/table/latest)
- [shadcn/ui](https://ui.shadcn.com)
- [cmdk](http://cmdk.paco.me)
- [nuqs](http://nuqs.47ng.com)
- [zustand](https://zustand.docs.pmnd.rs)
- [drizzle-orm](https://orm.drizzle.team)
- [zod](https://zod.dev)
- [superjson](https://github.com/flightcontrolhq/superjson)
- [date-fns](https://date-fns.org)
- [recharts](https://recharts.org)
- [dnd-kit](https://dndkit.com)

## Getting Started

No environment variable required for the default examples. For the Drizzle example, set `DATABASE_URL` to a PostgreSQL connection string.

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

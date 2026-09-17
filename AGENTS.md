# AGENTS.md

Two audiences. Pick the section that matches what you're doing.

---

## A. Using data-table-filters in someone's project

**What this is:** a set of shadcn registry blocks — React components, a schema
system, and server-side query helpers — that you copy into the user's repo with
the shadcn CLI. It is not an npm dependency. There is nothing to wrap and nothing
to eject from; after install, the code belongs to the user.

**Stack:** React 19+, TanStack Table v8, Tailwind CSS v4, shadcn/ui. Next.js App
Router is first-class; the blocks work in any React app.

> **Prerequisite.** Works on either shadcn library: the CLI default, Base UI (`npx shadcn@latest init -d`), or Radix (`npx shadcn@latest init -b radix -p nova`). CI installs into both and typechecks them on every registry change and nightly.
> Nothing to check before installing: the blocks resolve their primitives from
> whichever library `components.json` names.

**No project yet?** One command creates a Next.js app, initializes shadcn, and
installs a working `/example` route with every block it needs (add `-b radix`
before `-p nova` for Radix); run the dev server and open
http://localhost:3000/example:

```bash
npx shadcn@latest init @data-table-filters/data-table-example-infinite --name data-table-app --template next -p nova
```

**Load the full instructions before wiring anything up:**

| Resource                                                | What it gives you                                       |
| ------------------------------------------------------- | ------------------------------------------------------- |
| <https://data-table.openstatus.dev/api/mcp>             | These docs as an MCP server — see below                 |
| <https://data-table.openstatus.dev/llms.txt>            | Index: blocks, install recipes, docs links              |
| <https://data-table.openstatus.dev/llms-full.txt>       | Every documentation page in one file                    |
| <https://data-table.openstatus.dev/r/index.md>          | Block catalog with install commands and dependencies    |
| <https://data-table.openstatus.dev/docs/quick-start.md> | Any docs page as raw markdown — append `.md` to the URL |

**If you can use MCP,** add the docs server and ask it instead of fetching
pages. Streamable HTTP, no auth, four read-only tools: `get_install_plan` (goal
→ the exact shadcn command, wiring notes, and what to read next), `search_docs`,
`get_doc`, `list_blocks`.

```bash
claude mcp add --transport http data-table-filters https://data-table.openstatus.dev/api/mcp
```

**Claude Code users:** install the skill instead of reading the docs each time.

```bash
/plugin marketplace add openstatushq/data-table-filters
/plugin install data-table-filters@openstatus
```

Or, for any agent that supports the `skills` CLI:

```bash
npx skills add https://github.com/openstatushq/data-table-filters --skill data-table-filters
```

### Install recipes

Pick the goal, run the command, then wire it up per the docs. Every recipe
assumes a shadcn project on either library, as above.

**Large table — rows live in SQL and must be filtered server-side (100k+ rows):**

```bash
npx shadcn@latest add \
  @data-table-filters/data-table \
  @data-table-filters/data-table-schema \
  @data-table-filters/data-table-cell \
  @data-table-filters/data-table-sheet \
  @data-table-filters/data-table-drizzle \
  @data-table-filters/data-table-query \
  @data-table-filters/data-table-nuqs
```

Define the table once with `createTableSchema`, hand it to `createDrizzleHandler`
in a route handler and to `createDataTableQueryOptions` on the client. Filtering,
faceted counts, sorting, and cursor pagination run in SQL; rows are virtualized.
Table size is bounded by the database, not the browser.

**Client-side table — a few thousand rows already in memory:**

```bash
npx shadcn@latest add \
  @data-table-filters/data-table \
  @data-table-filters/data-table-cell \
  @data-table-filters/data-table-sheet
```

Use `useMemoryAdapter`. No API route, no schema block.

**Table pointed at an API endpoint — the data and its endpoint are owned
elsewhere, and there should be no per-column code in the app:**

```bash
npx shadcn@latest add \
  @data-table-filters/data-table \
  @data-table-filters/data-table-schema \
  @data-table-filters/data-table-query \
  @data-table-filters/data-table-nuqs \
  @data-table-filters/data-table-remote
```

Serve a manifest — schema, `primaryKey`, capabilities, actions — with
`createTableManifest` + `createTableManifestHandler` on the endpoint that owns
the data, then render `<DataTableRemote manifestEndpoint="/api/logs/schema" />`.
Declare only the capabilities the endpoint actually implements: they default to
off and the table degrades rather than rendering empty filters and blank counts.
Pass `initialManifest` (a build-time snapshot, or a server prefetch) to skip the
round trip before first paint, and `transport` for another origin, auth headers,
or a plain-JSON API.

**Unknown data shape:** install `data-table` + `data-table-schema`, then render
`<DataTableAuto data={json} />` — columns, filters, and sheet fields are inferred
from the data.

### Things that bite

- `DataTableInfinite` already renders `DataTableProvider`, `ControlsProvider`, and
  `DataTableStoreSync`. The only wrapper you add is `DataTableStoreProvider`.
- nuqs needs **both** `<NuqsAdapter>` in the root layout and a `<Suspense>`
  boundary around the table. Missing either fails silently or crashes.
- Use `field.string()`, not `field.string().default("")` — the latter produces
  phantom filters.
- The registry targets Tailwind v4. On v3, class syntax differs and things break
  quietly.
- A `SheetField.type` of `"readonly"` means no filter dropdown; match the filter
  type instead, or generate fields with `generateSheetFields()`.
- `createDataTableQueryOptions` defaults to a same-origin `fetch` and a SuperJSON
  body. For anyone else's API, pass `transport` (base URL, headers, credentials,
  `parseResponse`) and a `pagination` strategy — the default cursor is a
  millisecond timestamp, which is wrong for an offset API.

---

## B. Contributing to this repository

Read [CLAUDE.md](./CLAUDE.md) first — it is the authority on structure, testing,
and git workflow. The non-negotiables:

- pnpm + turborepo monorepo: `apps/web` (docs site + demos), `packages/registry`
  (registry source), `packages/tsconfig`.
- Branch from `main` (`feat/`, `fix/`, `refactor/`, `chore/`, `docs/`), and use
  conventional commits.
- Before committing: `pnpm prettier --check .`, `pnpm turbo lint`,
  `pnpm turbo typecheck`, `DATABASE_URL= pnpm turbo test`. Never `--no-verify`.
- Changes under `packages/registry/src/` need `pnpm registry:build`.
- Every utility and non-trivial branch gets a test; every bug fix gets a
  regression test.
- DB-dependent tests only run in CI. After pushing, check `gh pr checks`.

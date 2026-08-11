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

**Load the full instructions before wiring anything up:**

| Resource                                                | What it gives you                                       |
| ------------------------------------------------------- | ------------------------------------------------------- |
| <https://data-table.openstatus.dev/llms.txt>            | Index: blocks, install recipes, docs links              |
| <https://data-table.openstatus.dev/llms-full.txt>       | Every documentation page in one file                    |
| <https://data-table.openstatus.dev/r/index.md>          | Block catalog with install commands and dependencies    |
| <https://data-table.openstatus.dev/docs/quick-start.md> | Any docs page as raw markdown — append `.md` to the URL |

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

Pick the goal, run the command, then wire it up per the docs.

**Large table — rows live in SQL and must be filtered server-side (100k+ rows):**

```bash
npx shadcn@latest add \
  https://data-table.openstatus.dev/r/data-table.json \
  https://data-table.openstatus.dev/r/data-table-schema.json \
  https://data-table.openstatus.dev/r/data-table-cell.json \
  https://data-table.openstatus.dev/r/data-table-sheet.json \
  https://data-table.openstatus.dev/r/data-table-drizzle.json \
  https://data-table.openstatus.dev/r/data-table-query.json \
  https://data-table.openstatus.dev/r/data-table-nuqs.json
```

Define the table once with `createTableSchema`, hand it to `createDrizzleHandler`
in a route handler and to `createDataTableQueryOptions` on the client. Filtering,
faceted counts, sorting, and cursor pagination run in SQL; rows are virtualized.
Table size is bounded by the database, not the browser.

**Client-side table — a few thousand rows already in memory:**

```bash
npx shadcn@latest add \
  https://data-table.openstatus.dev/r/data-table.json \
  https://data-table.openstatus.dev/r/data-table-cell.json \
  https://data-table.openstatus.dev/r/data-table-sheet.json
```

Use `useMemoryAdapter`. No API route, no schema block.

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

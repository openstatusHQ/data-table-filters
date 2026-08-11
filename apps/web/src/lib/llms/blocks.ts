import manifest from "@dtf/registry-manifest";

export type RegistryItem = {
  name: string;
  title?: string;
  description?: string;
  registryDependencies?: string[];
  dependencies?: string[];
  files?: { path: string; type?: string }[];
};

export const registryItems: RegistryItem[] = manifest.items;

/**
 * Agent-facing "when do I need this block?" guidance.
 *
 * `registry.json` descriptions say what a block *is*; an agent picking blocks
 * needs to know when it applies. Kept here (not in registry.json) because it is
 * documentation, not part of the shadcn manifest contract.
 *
 * Every registry item must have an entry — enforced by `build.test.ts` so a new
 * block can't ship undocumented.
 */
export const BLOCK_GUIDANCE: Record<string, string> = {
  "data-table":
    "Always install first. Core engine: table, the 4 filter types (input, checkbox, slider, timerange), infinite scroll, virtualization, and the in-memory store adapter.",
  "data-table-filter-command":
    "The table needs a cmd+k command palette for power-user filter input, with query history and keyboard shortcuts.",
  "data-table-cell":
    "Columns need formatted rendering: badges, bars, heatmaps, status codes, log levels, booleans, timestamps.",
  "data-table-sheet":
    "Clicking a row should open a detail side panel. Auto-installs the cell renderers.",
  "data-table-nuqs":
    "Filter state must live in the URL so links are shareable and bookmarkable. The default choice for Next.js apps.",
  "data-table-zustand":
    "Filter state must live in client app state instead of the URL, or the app already uses zustand.",
  "data-table-schema":
    "One declarative definition should drive columns, filters, sheet fields, and sorting. Required by the drizzle, mcp, and ai-filters blocks.",
  "data-table-drizzle":
    "Rows live in a SQL database and must be filtered server-side. This is the block for large tables: SQL-side filtering, faceted counts, cursor pagination, and sorting.",
  "data-table-query":
    "The table fetches pages from an API endpoint — React Query infinite-query wiring with SuperJSON and facet merging.",
  "data-table-filter-command-ai":
    'Users should be able to filter in natural language ("errors in the last hour") on top of the command palette.',
  "data-table-mcp":
    "The table should be queryable by AI agents over MCP, using the same schema the UI uses.",
};

export type Recipe = {
  title: string;
  when: string;
  blocks: string[];
  notes: string;
};

/**
 * Ordered install recipes. Agents do far better with "for this goal, install
 * exactly these, in this order" than with a catalog they have to reason over.
 */
export const RECIPES: Recipe[] = [
  {
    title: "Large table (server-side, 100k+ rows)",
    when: "Rows live in Postgres/MySQL/SQLite and cannot be shipped to the client.",
    blocks: [
      "data-table",
      "data-table-schema",
      "data-table-cell",
      "data-table-sheet",
      "data-table-drizzle",
      "data-table-query",
      "data-table-nuqs",
    ],
    notes:
      "Define the table once with createTableSchema, pass it to createDrizzleHandler in a route handler, and to createDataTableQueryOptions on the client. Filtering, faceted counts, sorting, and cursor pagination all run in SQL; the client only ever holds the pages it rendered.",
  },
  {
    title: "Client-side table (data already in memory)",
    when: "A few thousand rows at most, already fetched or imported.",
    blocks: ["data-table", "data-table-cell", "data-table-sheet"],
    notes:
      "Use the memory adapter via useMemoryAdapter. No API route and no schema block required.",
  },
  {
    title: "Zero-config table from raw JSON",
    when: "The shape of the data is not known ahead of time.",
    blocks: ["data-table", "data-table-schema"],
    notes:
      "Render <DataTableAuto data={json} />, or call inferSchemaFromJSON + createTableSchema.fromJSON to get columns, filters, and sheet fields inferred from the data itself.",
  },
  {
    title: "AI-queryable table",
    when: "Agents or end users should query the table in natural language.",
    blocks: [
      "data-table",
      "data-table-schema",
      "data-table-filter-command",
      "data-table-filter-command-ai",
      "data-table-mcp",
    ],
    notes:
      "The schema drives all three surfaces: UI filters, the AI filter parser, and the MCP tool definition. Define columns once.",
  },
];

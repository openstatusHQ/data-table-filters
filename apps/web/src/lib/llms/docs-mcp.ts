import {
  searchDocs,
  splitIntoSections,
  type DocSection,
} from "@/lib/mdx/search";
import { BASE_URL } from "@/lib/metadata/shared-metadata";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { BLOCK_GUIDANCE, RECIPES, registryItems } from "./blocks";
import {
  blockUrl,
  buildDocMarkdown,
  installCommand,
  type DocSource,
} from "./build";

/**
 * The docs as an MCP server.
 *
 * `llms.txt` and the `.md` routes let an agent read the docs; this lets it ask
 * them a question. The content is the same — the difference is that the agent
 * gets the section that answers "how do faceted counts work" instead of
 * guessing a URL and paying for the whole page.
 */

export type DocsSource = () => Promise<DocSource[]>;

const SERVER_INSTRUCTIONS = `Docs and install recipes for data-table-filters, a React data table distributed as shadcn registry blocks (not an npm package — the code is copied into the user's repo).

Start with \`get_install_plan\` when the goal is to add a table: it returns the exact shadcn command for that goal and the docs to read next. Use \`search_docs\` for questions about behaviour or APIs, then \`get_doc\` to read a page in full. \`list_blocks\` is the catalog when the goal doesn't match a recipe.`;

function json(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
  };
}

function text(value: string) {
  return { content: [{ type: "text" as const, text: value }] };
}

function error(message: string) {
  return { ...text(message), isError: true as const };
}

export type SectionLoader = () => Promise<{
  docs: DocSource[];
  sections: DocSection[];
}>;

/** Reads and splits every docs page once, however many requests arrive. */
export function sectionLoader(loadDocs: DocsSource): SectionLoader {
  let cached: ReturnType<SectionLoader> | null = null;

  return () => {
    cached ??= loadDocs()
      .then((docs) => ({
        docs,
        sections: docs.flatMap(({ meta, source }) =>
          splitIntoSections(meta, source),
        ),
      }))
      // Cache the docs, not a failure to read them: one transient fs error
      // would otherwise be replayed to every later request on this instance.
      .catch((cause) => {
        cached = null;
        throw cause;
      });
    return cached;
  };
}

export function createDocsMcpServer(load: SectionLoader): McpServer {
  const server = new McpServer(
    { name: "data-table-filters-docs", version: "1.0.0" },
    { instructions: SERVER_INSTRUCTIONS },
  );

  server.registerTool(
    "search_docs",
    {
      title: "Search the docs",
      description:
        "Search the data-table-filters documentation. Returns the matching sections with a snippet and the page to read in full, ranked by relevance.",
      annotations: { readOnlyHint: true, openWorldHint: false },
      inputSchema: {
        query: z
          .string()
          .min(2)
          .describe(
            'What to look for, e.g. "cursor pagination", "nuqs adapter", "faceted counts"',
          ),
        limit: z.number().int().min(1).max(20).default(5),
      },
    },
    async ({ query, limit }) => {
      const { sections } = await load();
      const results = searchDocs(sections, query, { limit });

      if (results.length === 0) {
        return json({
          results: [],
          hint: `No section matched "${query}". Call list_blocks for the block catalog, or get_doc with one of: ${sections
            .map((section) => section.slug)
            .filter((slug, index, all) => all.indexOf(slug) === index)
            .join(", ")}.`,
        });
      }

      return json({
        results: results.map(({ score: _score, anchor, ...result }) => ({
          ...result,
          url: `${BASE_URL}/docs/${result.slug}${anchor ? `#${anchor}` : ""}`,
        })),
        hint: "Call get_doc with a `slug` to read any of these pages in full.",
      });
    },
  );

  server.registerTool(
    "get_doc",
    {
      title: "Read a docs page",
      description:
        "Read one documentation page as markdown. Pass `heading` to get a single section instead of the whole page.",
      annotations: { readOnlyHint: true, openWorldHint: false },
      inputSchema: {
        slug: z
          .string()
          .describe(
            'Page slug, e.g. "quick-start", "drizzle-orm", "table-schema"',
          ),
        heading: z
          .string()
          .optional()
          .describe("A heading from that page, as returned by search_docs"),
      },
    },
    async ({ slug, heading }) => {
      const { docs, sections } = await load();
      const doc = docs.find(({ meta }) => meta.slug === slug);

      if (!doc) {
        return error(
          `No page "${slug}". Available: ${docs.map(({ meta }) => meta.slug).join(", ")}.`,
        );
      }

      if (!heading) return text(buildDocMarkdown(doc.meta, doc.source));

      const wanted = heading.trim().toLowerCase();
      const section = sections.find(
        (candidate) =>
          candidate.slug === slug &&
          candidate.heading?.toLowerCase() === wanted,
      );

      if (!section) {
        const available = sections
          .filter((candidate) => candidate.slug === slug && candidate.heading)
          .map((candidate) => candidate.heading);
        return error(
          `No heading "${heading}" on "${slug}". Headings: ${available.join(", ")}.`,
        );
      }

      return text(
        `# ${doc.meta.title} — ${section.heading}\n\n${section.body}`,
      );
    },
  );

  server.registerTool(
    "list_blocks",
    {
      title: "List the registry blocks",
      description:
        "The registry catalog: every installable block, what it adds, when to use it, and its install URL.",
      annotations: { readOnlyHint: true, openWorldHint: false },
      inputSchema: {},
    },
    async () =>
      json({
        install: `npx shadcn@latest add ${blockUrl("<block>")}`,
        note: "The shadcn CLI installs each block's registry dependencies automatically, so listing a dependency explicitly is redundant but harmless.",
        blocks: registryItems.map((item) => ({
          name: item.name,
          description: item.description,
          useWhen: BLOCK_GUIDANCE[item.name],
          url: blockUrl(item.name),
          pullsIn: (item.registryDependencies ?? [])
            .map((dep) => dep.match(/\/r\/([\w-]+)\.json$/)?.[1])
            .filter((name): name is string => Boolean(name)),
        })),
      }),
  );

  server.registerTool(
    "get_install_plan",
    {
      title: "Get an install plan",
      description:
        "The exact blocks to install for a goal, as one copy-pasteable command, plus how to wire them up and which docs to read next.",
      annotations: { readOnlyHint: true, openWorldHint: false },
      inputSchema: {
        goal: z
          .enum(RECIPES.map((recipe) => recipe.id) as [string, ...string[]])
          .describe("Which kind of table is being built"),
      },
    },
    async ({ goal }) => {
      const recipe = RECIPES.find((candidate) => candidate.id === goal);
      if (!recipe) {
        return error(
          `No recipe "${goal}". Available: ${RECIPES.map((r) => r.id).join(", ")}.`,
        );
      }

      const { docs } = await load();

      return json({
        goal: recipe.id,
        title: recipe.title,
        when: recipe.when,
        command: installCommand(recipe.blocks),
        blocks: recipe.blocks,
        wiring: recipe.notes,
        readNext: recipe.docs.map((slug) => ({
          slug,
          title:
            docs.find(({ meta }) => meta.slug === slug)?.meta.title ?? slug,
        })),
      });
    },
  );

  return server;
}

/**
 * Stateless Streamable HTTP handler — one server per request, so it runs on
 * serverless with no session store, the same way the `data-table-mcp` block does.
 */
export function createDocsMcpHandler(loadDocs: DocsSource) {
  // The docs are read once; the server is per request, because a stateless
  // transport owns the connection for the length of that request.
  const load = sectionLoader(loadDocs);

  return async function handler(request: Request): Promise<Response> {
    // A GET opens the standalone SSE stream the spec uses for server-initiated
    // messages. This server has none to send, and the request-scoped server
    // below is closed the moment the response is returned — which would hand
    // the client a stream that is already at EOF, and some clients then
    // reconnect in a loop. The spec's answer for a server that doesn't offer
    // that stream is 405.
    if (request.method === "GET") return methodNotAllowed();

    const server = createDocsMcpServer(load);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    await server.connect(transport);
    try {
      return await transport.handleRequest(request);
    } finally {
      await server.close();
    }
  };
}

function methodNotAllowed(): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Method Not Allowed: this server has no standalone SSE stream",
      },
      id: null,
    }),
    {
      status: 405,
      headers: { "content-type": "application/json", allow: "POST, DELETE" },
    },
  );
}

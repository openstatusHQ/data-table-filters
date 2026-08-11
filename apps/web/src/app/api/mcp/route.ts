import { createDocsMcpHandler } from "@/lib/llms/docs-mcp";
import { getAllSections, getSection } from "@/lib/mdx";

/**
 * The documentation as an MCP server, at `/api/mcp`.
 *
 * Add it once and an agent can ask the docs a question — `search_docs`,
 * `get_doc`, `list_blocks`, `get_install_plan` — instead of fetching pages by
 * URL and reading around the answer.
 */
const handler = createDocsMcpHandler(async () => {
  const sections = await getAllSections("docs");

  const docs = await Promise.all(
    sections.map(async (meta) => {
      const section = await getSection("docs", meta.slug);
      return section ? { meta, source: section.source } : null;
    }),
  );

  return docs.filter((doc) => doc !== null);
});

export { handler as DELETE, handler as GET, handler as POST };

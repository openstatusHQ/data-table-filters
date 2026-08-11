import { getAllSections, getSection } from "@/lib/mdx";
import { searchDocs, splitIntoSections } from "@/lib/mdx/search";

/** Rows the ⌘K palette can show without scrolling into uselessness. */
const LIMIT = 10;

/**
 * Search behind the ⌘K palette.
 *
 * Shares its ranking with the MCP server's `search_docs` tool — see
 * `@/lib/mdx/search`. The palette lists pages, so results collapse to the
 * best-scoring section of each, and that section's anchor goes in the href.
 */
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q");

  if (!query) return Response.json([]);

  const metas = await getAllSections("docs");
  const sections = (
    await Promise.all(
      metas.map(async (meta) => {
        const section = await getSection("docs", meta.slug);
        return section ? splitIntoSections(meta, section.source) : [];
      }),
    )
  ).flat();

  const results = searchDocs(sections, query, {
    limit: LIMIT,
    onePerPage: true,
  }).map((result) => ({
    title: result.title,
    slug: result.slug,
    // `?q=` drives the in-page highlight; the anchor jumps to the section.
    href: `/docs/${result.slug}?q=${encodeURIComponent(query)}${
      result.anchor ? `#${result.anchor}` : ""
    }`,
    content: result.snippet,
  }));

  return Response.json(results);
}

import { buildDocMarkdown } from "@/lib/llms/build";
import { getAllSections, getSection } from "@/lib/mdx";
import { BASE_URL } from "@/lib/metadata/shared-metadata";

export const dynamic = "force-static";

export async function generateStaticParams() {
  const sections = await getAllSections("docs");
  return sections.map((section) => ({ slug: section.slug }));
}

/**
 * Raw markdown for a docs page. Reachable as `/docs/<slug>.md` via the rewrite
 * in `next.config.mjs` — the HTML page costs an agent several times the tokens
 * and loses code-fence fidelity on the way through.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const section = await getSection("docs", slug);

  if (!section) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(buildDocMarkdown(section.meta, section.source), {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400",
      // Both representations are in the sitemap, so point search engines at the
      // HTML page as the indexable one. Plain text can't carry a <link>, which
      // is why this rides on the header instead.
      link: `<${BASE_URL}/docs/${slug}>; rel="canonical"`,
    },
  });
}

import { buildLlmsFullTxt, type DocSource } from "@/lib/llms/build";
import { getAllSections, getSection } from "@/lib/mdx";

export const dynamic = "force-static";

export async function GET() {
  const sections = await getAllSections("docs");

  const docs = await Promise.all(
    sections.map(async (meta) => {
      const section = await getSection("docs", meta.slug);
      return section ? { meta, source: section.source } : null;
    }),
  );

  return new Response(buildLlmsFullTxt(docs.filter(Boolean) as DocSource[]), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}

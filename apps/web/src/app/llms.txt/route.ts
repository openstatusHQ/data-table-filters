import { buildLlmsTxt } from "@/lib/llms/build";
import { getAllSections } from "@/lib/mdx";

export const dynamic = "force-static";

export async function GET() {
  const sections = await getAllSections("docs");

  return new Response(buildLlmsTxt(sections), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}

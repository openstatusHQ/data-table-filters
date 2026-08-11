import { buildRegistryIndexMd } from "@/lib/llms/build";

export const dynamic = "force-static";

export async function GET() {
  return new Response(buildRegistryIndexMd(), {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}

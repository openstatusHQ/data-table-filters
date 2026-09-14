import { registryItems } from "@/lib/llms/blocks";
import { installSummary } from "@/lib/registry/installs";
import { Redis } from "@upstash/redis";
import { NextResponse, type NextRequest } from "next/server";

/**
 * `GET /api/registry/installs?days=7` — registry fetches per block per day,
 * distinct install runs per day, and CLI vs browser hits. Counts only; the
 * fingerprints behind `runs` never leave Redis.
 */
export async function GET(request: NextRequest) {
  if (
    !process.env.UPSTASH_REDIS_REST_URL ||
    !process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    return NextResponse.json(
      { error: "Install counting is not configured." },
      { status: 503 },
    );
  }

  const requested = Number(request.nextUrl.searchParams.get("days") ?? 7);
  const days = Number.isInteger(requested)
    ? Math.min(Math.max(requested, 1), 90)
    : 7;

  const summary = await installSummary(Redis.fromEnv(), {
    blocks: registryItems.map((item) => item.name),
    today: new Date(),
    days,
  });

  return NextResponse.json(summary, {
    headers: {
      "cache-control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}

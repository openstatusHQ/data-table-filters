import { installEvent, recordInstall } from "@/lib/registry/installs";
import { Redis } from "@upstash/redis";
import { after, NextResponse, type NextRequest } from "next/server";

/**
 * Counts registry installs. `/r/*.json` are static files served from the CDN,
 * so this is the only code that sees a `shadcn add`; it records the fetch
 * after the response is sent and never changes it. Without Upstash
 * credentials (local dev, CI) it is a pass-through.
 */
export const config = { matcher: ["/r/:path*"] };

export function proxy(request: NextRequest) {
  const event = installEvent({
    pathname: request.nextUrl.pathname,
    userAgent: request.headers.get("user-agent"),
    ip:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "",
    at: new Date(),
  });

  if (
    event &&
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    after(() =>
      recordInstall(Redis.fromEnv(), event).catch((error: unknown) => {
        console.error("[registry-installs] failed to record", error);
      }),
    );
  }

  return NextResponse.next();
}

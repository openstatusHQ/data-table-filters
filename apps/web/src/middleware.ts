import { classifyUserAgent } from "@/lib/analytics/user-agent";
import {
  NextResponse,
  type NextFetchEvent,
  type NextRequest,
} from "next/server";

const PLAUSIBLE_DOMAIN = "data-table.openstatus.dev";

/**
 * Registry JSON and raw-markdown docs are the cleanest agent-traffic signal on
 * the site: nobody browses `/r/data-table.json` for fun, so a fetch of it is
 * almost always a tool installing or reading the library on someone's behalf.
 *
 * Two sinks, deliberately:
 *  - a structured log line, which always works and can be queried from Vercel
 *  - a Plausible custom event, which is nicer to look at but drops traffic whose
 *    user-agent Plausible classifies as a bot — i.e. exactly the crawler share.
 *    Treat the logs as the source of truth and Plausible as the dashboard.
 */
export const config = {
  matcher: ["/r/:path*", "/docs/:slug.md", "/llms.txt", "/llms-full.txt"],
};

function surfaceFor(pathname: string): string {
  if (pathname.startsWith("/r/")) return "registry";
  if (pathname.endsWith(".md")) return "docs-markdown";
  return "llms-txt";
}

export function middleware(request: NextRequest, event: NextFetchEvent) {
  const { pathname } = request.nextUrl;
  const { kind, name } = classifyUserAgent(request.headers.get("user-agent"));
  const surface = surfaceFor(pathname);

  console.log(
    JSON.stringify({
      event: "asset_fetch",
      surface,
      path: pathname,
      client_kind: kind,
      client_name: name,
      referer: request.headers.get("referer") ?? undefined,
    }),
  );

  if (process.env.NODE_ENV === "production") {
    event.waitUntil(
      fetch("https://plausible.io/api/event", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-agent": request.headers.get("user-agent") ?? "unknown",
          "x-forwarded-for":
            request.headers.get("x-forwarded-for") ?? "127.0.0.1",
        },
        body: JSON.stringify({
          domain: PLAUSIBLE_DOMAIN,
          name: "Asset Fetch",
          url: request.nextUrl.toString(),
          props: {
            surface,
            client_kind: kind,
            client_name: name,
            path: pathname,
          },
        }),
      }).catch(() => {
        // Measurement must never break a download.
      }),
    );
  }

  return NextResponse.next();
}

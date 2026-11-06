import type { NextRequest } from "next/server";
import { CORS_HEADERS, listOrders } from "./table";

export const dynamic = "force-dynamic";

/** `GET /headless/api/orders` — the list endpoint, as ordinary JSON. */
export function GET(request: NextRequest): Response {
  const query = Object.fromEntries(request.nextUrl.searchParams);
  return Response.json(listOrders(query), { headers: CORS_HEADERS });
}

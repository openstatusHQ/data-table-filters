import { createTableManifestHandler } from "@dtf/registry/lib/table-schema";
import { CORS_HEADERS, manifest } from "../table";

/** `GET /headless/api/orders/schema` — what the list endpoint says about itself. */
const handler = createTableManifestHandler(manifest, { headers: CORS_HEADERS });

export function GET(request: Request): Promise<Response> {
  return handler(request);
}

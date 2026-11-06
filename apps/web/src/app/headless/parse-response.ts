import {
  coerceRowTimestamps,
  type InfiniteQueryResponse,
  type ResponseParser,
} from "@dtf/registry/lib/data-table";
import SuperJSON from "superjson";

type Row = Record<string, unknown>;
type ListPayload = InfiniteQueryResponse<Row[], unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Turn whatever a list endpoint sent into the payload the table reads.
 *
 * A page that takes any endpoint cannot be told ahead of time how that endpoint
 * encodes its body, so it looks. Three encodings are in use:
 *
 * 1. `Response.json(SuperJSON.stringify(payload))` — this repo's own routes. The
 *    body is a JSON *string* holding the SuperJSON envelope.
 * 2. `Response.json(SuperJSON.serialize(payload))` — the envelope as an object:
 *    `{ json, meta }`, and no `data` key of its own.
 * 3. Ordinary JSON. Timestamp columns arrive as ISO strings or epoch numbers
 *    and are revived to `Date` from the manifest's schema.
 */
export function reviveListPayload(
  body: unknown,
  timestampColumns: string[],
): ListPayload {
  if (typeof body === "string") {
    return SuperJSON.parse<ListPayload>(body);
  }
  if (isRecord(body) && "json" in body && !("data" in body)) {
    return SuperJSON.deserialize<ListPayload>(
      body as unknown as Parameters<typeof SuperJSON.deserialize>[0],
    );
  }
  const payload = body as ListPayload;
  if (isRecord(payload) && Array.isArray(payload.data)) {
    for (const row of payload.data) {
      coerceRowTimestamps(row, timestampColumns);
    }
  }
  return payload;
}

/** {@link reviveListPayload} as a transport parser. */
export function autoParser(
  timestampColumns: string[],
): ResponseParser<Row[], unknown> {
  return async (response) =>
    reviveListPayload(await response.json(), timestampColumns);
}

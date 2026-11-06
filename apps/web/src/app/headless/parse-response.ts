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
 * 3. Ordinary JSON.
 *
 * Whichever it was, timestamp columns that are still ISO strings or epoch
 * numbers afterwards are revived to `Date` from the manifest's schema.
 */
export function reviveListPayload(
  body: unknown,
  timestampColumns: string[],
): ListPayload {
  let payload: ListPayload;
  if (typeof body === "string") {
    payload = SuperJSON.parse<ListPayload>(body);
  } else if (isRecord(body) && "json" in body && !("data" in body)) {
    payload = SuperJSON.deserialize<ListPayload>(
      body as unknown as Parameters<typeof SuperJSON.deserialize>[0],
    );
  } else {
    payload = body as ListPayload;
  }
  // After every branch, not only the plain one: an endpoint may wrap its
  // payload in SuperJSON and still send its dates as strings.
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

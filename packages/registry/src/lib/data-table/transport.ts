import SuperJSON from "superjson";
import type { InfiniteQueryResponse } from "./create-query-options";

/**
 * The transport layer: everything about *how* the table talks to an endpoint,
 * separated from *what* it asks for.
 *
 * The table used to hard-code all of this — same-origin `fetch`, no headers, no
 * `response.ok` check, SuperJSON, and a numeric-timestamp cursor. That works for
 * an endpoint we own and nothing else, which is why the schema builder had to
 * write its own offset-based query options rather than reuse the block. A
 * headless table pointed at someone else's API needs each of those four to be a
 * choice.
 */

// ── Errors ──────────────────────────────────────────────────────────────────

/**
 * A non-2xx response, or a body that could not be parsed.
 *
 * Thrown instead of letting a 500's HTML reach `SuperJSON.parse` and surface as
 * an opaque syntax error. React Query surfaces this as the query's `error`, so
 * the status and URL are the two things a caller needs to render something
 * useful.
 */
export class DataTableFetchError extends Error {
  readonly status: number;
  readonly url: string;
  /** First 500 chars of the response body, when one was readable. */
  readonly body?: string;

  constructor(args: {
    message: string;
    status: number;
    url: string;
    body?: string;
    cause?: unknown;
  }) {
    super(args.message, { cause: args.cause });
    this.name = "DataTableFetchError";
    this.status = args.status;
    this.url = args.url;
    this.body = args.body;
  }
}

// ── Response parsing ────────────────────────────────────────────────────────

export type ResponseParser<TData, TMeta> = (
  response: Response,
) => Promise<InfiniteQueryResponse<TData, TMeta>>;

/** Reads at most `limit` chars of a body for an error message, never throwing. */
async function readBodySnippet(
  response: Response,
  limit = 500,
): Promise<string | undefined> {
  try {
    const text = await response.text();
    return text.slice(0, limit);
  } catch {
    return undefined;
  }
}

/**
 * The historical default: the server `SuperJSON.stringify`s its payload, so
 * `Date`s survive the wire without the client knowing which columns hold them.
 */
export function superjsonParser<TData, TMeta>(): ResponseParser<TData, TMeta> {
  return async (response) => {
    const json = await response.json();
    return SuperJSON.parse<InfiniteQueryResponse<TData, TMeta>>(json);
  };
}

/**
 * Plain JSON, taken exactly as the endpoint sent it.
 *
 * Timestamps arrive as whatever the endpoint serialized them to — usually ISO
 * strings. Use {@link schemaJsonParser} when the schema is available and those
 * should become `Date`s.
 */
export function jsonParser<TData, TMeta>(): ResponseParser<TData, TMeta> {
  return async (response) =>
    (await response.json()) as InfiniteQueryResponse<TData, TMeta>;
}

/**
 * Path segments that reach an object's prototype rather than its own data.
 *
 * Column keys come from the manifest, which is server-authored and untrusted.
 * Walking `"__proto__.x"` with a naive object guard writes to
 * `Object.prototype` — `row["__proto__"]` *is* an object, so a `typeof`
 * check passes it — polluting every object in the tab from the first parsed
 * response.
 *
 * This name list is the *secondary* guard. It cannot be the primary one: it
 * enumerates bad names, and `"meta.toString"` is not on it while still
 * resolving an inherited method. The primary guard is `Object.hasOwn` on every
 * traversed segment (see `getPath`/`setPath`), which states the real invariant
 * — this segment is the row's own data — and subsumes these names, because
 * they are inherited rather than own. The list is kept for the one place
 * `hasOwn` cannot help: the final segment of a write, which may not exist yet.
 */
const RESERVED_SEGMENTS: ReadonlySet<string> = new Set([
  "__proto__",
  "constructor",
  "prototype",
]);

/** True when every segment of a dotted path addresses own data. */
export function isSafeKeyPath(path: string): boolean {
  return path.split(".").every((segment) => !RESERVED_SEGMENTS.has(segment));
}

/** The subset of a `SchemaJSON` this module needs: which keys hold timestamps. */
export type TimestampKeySource = {
  columns: readonly { key: string; kind?: string }[];
};

/**
 * Collect the keys of every `timestamp` column, including nested ones written
 * with the `"timing.dns"` dotted convention.
 */
export function timestampKeys(schema: TimestampKeySource): string[] {
  return schema.columns
    .filter((column) => column.kind === "timestamp")
    .map((column) => column.key)
    .filter(isSafeKeyPath);
}

/** Reads a possibly-dotted key path off a row. */
function getPath(row: Record<string, unknown>, path: string): unknown {
  if (!isSafeKeyPath(path)) return undefined;
  // A row may carry the dotted key literally — `createDrizzleHandler` projects
  // `"timing.dns"` as a flat property — so the exact key wins before the path
  // is walked.
  if (Object.hasOwn(row, path)) return row[path];
  if (!path.includes(".")) return undefined;
  let current: unknown = row;
  for (const segment of path.split(".")) {
    if (current === null || typeof current !== "object") return undefined;
    // Own data only. Without this, `"meta.toString"` resolves an inherited
    // method that is identical on every row.
    if (!Object.hasOwn(current, segment)) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/** Writes a possibly-dotted key path on a row, creating objects as needed. */
function setPath(
  row: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  if (!isSafeKeyPath(path)) return;
  // Mirrors `getPath`: a literal dotted key is written back where it was read.
  if (Object.hasOwn(row, path) || !path.includes(".")) {
    row[path] = value;
    return;
  }
  const segments = path.split(".");
  const last = segments.pop()!;
  let current: Record<string, unknown> = row;
  for (const segment of segments) {
    // Own data only. An inherited intermediate object is shared with every
    // other row on that prototype, so writing through it corrupts siblings.
    if (!Object.hasOwn(current, segment)) return;
    const next = current[segment];
    if (next === null || typeof next !== "object") return;
    current = next as Record<string, unknown>;
  }
  // `last` may legitimately not exist yet, so `hasOwn` cannot gate it —
  // `isSafeKeyPath` above is what keeps it from being `__proto__`.
  current[last] = value;
}

/**
 * Coerce one row's timestamp columns to `Date`.
 *
 * Anything already a `Date` is left alone, and anything that does not parse is
 * left alone too — a column the endpoint sent as `null`, `""`, or a string we
 * do not understand stays as it was rather than becoming an `Invalid Date` that
 * renders as "Invalid Date" three layers down.
 */
export function coerceRowTimestamps<TRow>(row: TRow, keys: string[]): TRow {
  if (row === null || typeof row !== "object") return row;
  const record = row as Record<string, unknown>;
  for (const key of keys) {
    const value = getPath(record, key);
    if (value instanceof Date) continue;
    if (typeof value !== "string" && typeof value !== "number") continue;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) continue;
    setPath(record, key, date);
  }
  return row;
}

/**
 * Plain JSON, with timestamp columns revived to `Date` using the schema.
 *
 * This is what makes a third-party endpoint work without asking it to adopt
 * SuperJSON: we already know from the schema which columns are timestamps, so
 * ISO strings can be revived on the way in.
 */
export function schemaJsonParser<TData, TMeta>(
  schema: TimestampKeySource,
): ResponseParser<TData, TMeta> {
  const keys = timestampKeys(schema);
  return async (response) => {
    const payload = (await response.json()) as InfiniteQueryResponse<
      TData,
      TMeta
    >;
    if (keys.length === 0) return payload;
    if (Array.isArray(payload.data)) {
      for (const row of payload.data) coerceRowTimestamps(row, keys);
    }
    return payload;
  };
}

// ── Transport ───────────────────────────────────────────────────────────────

export type Transport<TData = unknown, TMeta = unknown> = {
  /**
   * Prefix for the endpoint path. A string, or a function called per request
   * for the cases where it is only known at call time.
   *
   * Defaults to {@link defaultBaseUrl}: same-origin in the browser, `VERCEL_URL`
   * or localhost on the server. Point it at another origin to talk to an API
   * that is not the app — that endpoint then needs CORS.
   */
  baseUrl?: string | (() => string);
  /**
   * Per-request headers. A function so an auth token can be read fresh on every
   * request rather than captured once at module scope, and async so it can wait
   * on a token refresh.
   */
  headers?: HeadersInit | (() => HeadersInit | Promise<HeadersInit>);
  /** Passed through to `fetch` — `"include"` for cookie-authenticated APIs. */
  credentials?: RequestCredentials;
  /** Swappable `fetch`, for tests and for runtimes that wrap it. */
  fetch?: typeof fetch;
  /** How to turn a `Response` into the payload. Defaults to {@link superjsonParser}. */
  parseResponse?: ResponseParser<TData, TMeta>;
};

/** Same-origin in the browser; `VERCEL_URL` or localhost on the server. */
export function defaultBaseUrl(): string {
  if (typeof window !== "undefined") return "";
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

/** Only the base URL matters here, so the parameter is narrowed to it. */
type BaseUrlSource = { baseUrl?: string | (() => string) };

function resolveBaseUrl(transport: BaseUrlSource | undefined) {
  const baseUrl = transport?.baseUrl;
  if (baseUrl === undefined) return defaultBaseUrl();
  return typeof baseUrl === "function" ? baseUrl() : baseUrl;
}

/**
 * Perform one request and parse it, raising {@link DataTableFetchError} on a
 * non-2xx status or an unparseable body.
 */
export async function transportFetch<TData, TMeta>(
  url: string,
  transport: Transport<TData, TMeta> | undefined,
  init?: { signal?: AbortSignal },
): Promise<InfiniteQueryResponse<TData, TMeta>> {
  const doFetch = transport?.fetch ?? fetch;
  const headers =
    typeof transport?.headers === "function"
      ? await transport.headers()
      : transport?.headers;

  const response = await doFetch(url, {
    headers,
    credentials: transport?.credentials,
    signal: init?.signal,
  });

  if (!response.ok) {
    throw new DataTableFetchError({
      message:
        `Request to ${url} failed with ${response.status} ${response.statusText}`.trim(),
      status: response.status,
      url,
      body: await readBodySnippet(response),
    });
  }

  const parse = transport?.parseResponse ?? superjsonParser<TData, TMeta>();
  try {
    return await parse(response);
  } catch (cause) {
    throw new DataTableFetchError({
      message: `Could not parse the response from ${url}`,
      status: response.status,
      url,
      cause,
    });
  }
}

/** Joins a base URL and a path without doubling or dropping the separator. */
export function resolveUrl(
  transport: BaseUrlSource | undefined,
  path: string,
): string {
  const base = resolveBaseUrl(transport);
  if (!base) return path;
  return `${base.replace(/\/$/, "")}${path.startsWith("/") ? "" : "/"}${path}`;
}

// ── Pagination ──────────────────────────────────────────────────────────────

/**
 * How pages are addressed.
 *
 * The table used to assume one answer — a numeric millisecond timestamp read
 * from a `date` column, defaulting to `Date.now()`. That is a good default for
 * an append-only log and wrong for everything else, so it is now one strategy
 * among several.
 *
 * `TPageParam` is whatever React Query carries between pages. It is written into
 * the search object by `applyPageParam` before serialization, so a strategy
 * fully owns its wire representation.
 */
export type PaginationStrategy<TPageParam = unknown> = {
  /** Page param for the first request, derived from the current filter state. */
  getInitialPageParam: (search: Record<string, unknown>) => TPageParam;
  /** `null` ends the list. */
  getNextPageParam: (
    lastPage: InfiniteQueryResponse<unknown, unknown>,
    lastPageParam: TPageParam,
  ) => TPageParam | null;
  /** `null` means "no backwards paging" — live mode stays off. */
  getPreviousPageParam: (
    firstPage: InfiniteQueryResponse<unknown, unknown>,
    firstPageParam: TPageParam,
  ) => TPageParam | null;
  /** Merge the page param into the search object sent to the serializer. */
  applyPageParam: (
    search: Record<string, unknown>,
    pageParam: TPageParam,
  ) => Record<string, unknown>;
  /**
   * Search keys this strategy owns. Cleared when building the cache key, so two
   * pages of the same filter state share one query key.
   */
  readonly pageParamKeys: readonly string[];
};

export type TimestampCursorPageParam = {
  cursor: number;
  direction: "next" | "prev";
};

/**
 * Cursor over a timestamp column, paging in both directions. The historical
 * default, unchanged: the cursor is epoch milliseconds, the first page starts
 * at `search.cursor` or now, and `direction` tells the server which way to read.
 */
export function timestampCursorPagination(options?: {
  cursorKey?: string;
  directionKey?: string;
}): PaginationStrategy<TimestampCursorPageParam> {
  const cursorKey = options?.cursorKey ?? "cursor";
  const directionKey = options?.directionKey ?? "direction";
  return {
    pageParamKeys: [cursorKey, directionKey],
    getInitialPageParam: (search) => {
      const cursor = search[cursorKey] as Date | undefined;
      return {
        cursor: cursor?.getTime?.() ?? Date.now(),
        direction: "next",
      };
    },
    getNextPageParam: (lastPage) =>
      lastPage.nextCursor
        ? { cursor: Number(lastPage.nextCursor), direction: "next" }
        : null,
    getPreviousPageParam: (firstPage) =>
      firstPage.prevCursor
        ? { cursor: Number(firstPage.prevCursor), direction: "prev" }
        : null,
    applyPageParam: (search, pageParam) => ({
      ...search,
      [cursorKey]: new Date(pageParam.cursor),
      [directionKey]: pageParam.direction,
    }),
  };
}

/**
 * An opaque cursor the client never interprets — the server's `nextCursor` is
 * echoed back verbatim. Forward-only, because an opaque token carries no
 * ordering the client could reverse.
 */
export function opaqueCursorPagination(options?: {
  cursorKey?: string;
}): PaginationStrategy<string | number | null> {
  const cursorKey = options?.cursorKey ?? "cursor";
  return {
    pageParamKeys: [cursorKey],
    getInitialPageParam: (search) =>
      (search[cursorKey] as string | number | null | undefined) ?? null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? null,
    getPreviousPageParam: () => null,
    applyPageParam: (search, pageParam) => ({
      ...search,
      [cursorKey]: pageParam,
    }),
  };
}

/**
 * Offset/limit paging, for endpoints with no cursor at all.
 *
 * `nextCursor` is honoured as the next offset when the server sends one;
 * otherwise the offset advances by `size` until a page comes back short, which
 * is the only end-of-list signal a bare offset API gives.
 */
export function offsetPagination(options: {
  size: number;
  offsetKey?: string;
  sizeKey?: string;
}): PaginationStrategy<number> {
  const offsetKey = options.offsetKey ?? "offset";
  const sizeKey = options.sizeKey ?? "size";
  const size = options.size;
  return {
    pageParamKeys: [offsetKey],
    getInitialPageParam: (search) => Number(search[offsetKey] ?? 0),
    getNextPageParam: (lastPage, lastPageParam) => {
      if (lastPage.nextCursor !== null && lastPage.nextCursor !== undefined) {
        return Number(lastPage.nextCursor);
      }
      // No cursor from the server: infer from what arrived. A short page is the
      // last page; a full one might not be, so ask for the next window. The
      // offset has to accumulate across pages, which is why the strategy is
      // handed the page param that produced this page.
      const rows = Array.isArray(lastPage.data) ? lastPage.data.length : 0;
      return rows < size ? null : lastPageParam + rows;
    },
    getPreviousPageParam: () => null,
    applyPageParam: (search, pageParam) => ({
      ...search,
      [offsetKey]: pageParam,
      [sizeKey]: search[sizeKey] ?? size,
    }),
  };
}

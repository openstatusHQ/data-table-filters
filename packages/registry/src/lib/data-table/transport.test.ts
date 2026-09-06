import SuperJSON from "superjson";
import { describe, expect, it, vi } from "vitest";
import type { InfiniteQueryResponse } from "./create-query-options";
import {
  coerceRowTimestamps,
  DataTableFetchError,
  jsonParser,
  offsetPagination,
  opaqueCursorPagination,
  resolveUrl,
  schemaJsonParser,
  superjsonParser,
  timestampCursorPagination,
  timestampKeys,
  transportFetch,
} from "./transport";

function response(
  body: string,
  init?: { status?: number; statusText?: string },
): Response {
  return new Response(body, {
    status: init?.status ?? 200,
    statusText: init?.statusText ?? "OK",
    headers: { "content-type": "application/json" },
  });
}

function page(
  overrides?: Partial<InfiniteQueryResponse<unknown[], unknown>>,
): InfiniteQueryResponse<unknown[], unknown> {
  return {
    data: [],
    meta: {
      totalRowCount: 0,
      filterRowCount: 0,
      chartData: [],
      facets: {},
    },
    nextCursor: null,
    prevCursor: null,
    ...overrides,
  };
}

// ── URL resolution ──────────────────────────────────────────────────────────

describe("resolveUrl", () => {
  it("prefixes an explicit base URL", () => {
    expect(resolveUrl({ baseUrl: "https://api.example.com" }, "/logs")).toBe(
      "https://api.example.com/logs",
    );
  });

  it("does not double the separator", () => {
    expect(resolveUrl({ baseUrl: "https://api.example.com/" }, "/logs")).toBe(
      "https://api.example.com/logs",
    );
  });

  it("inserts a separator when the path has none", () => {
    expect(resolveUrl({ baseUrl: "https://api.example.com" }, "logs")).toBe(
      "https://api.example.com/logs",
    );
  });

  it("calls a function base URL per request", () => {
    let calls = 0;
    const transport = {
      baseUrl: () => `https://api-${++calls}.example.com`,
    };
    expect(resolveUrl(transport, "/logs")).toBe(
      "https://api-1.example.com/logs",
    );
    expect(resolveUrl(transport, "/logs")).toBe(
      "https://api-2.example.com/logs",
    );
  });

  it("leaves the path alone when the base URL is empty (same origin)", () => {
    expect(resolveUrl({ baseUrl: "" }, "/logs?a=1")).toBe("/logs?a=1");
  });
});

// ── transportFetch ──────────────────────────────────────────────────────────

describe("transportFetch", () => {
  it("parses a SuperJSON payload by default, reviving Dates", async () => {
    const payload = page({
      data: [{ date: new Date("2024-01-01T00:00:00Z") }],
    });
    const fetchMock = vi.fn(async () =>
      response(JSON.stringify(SuperJSON.stringify(payload))),
    );

    const result = await transportFetch<{ date: Date }[], unknown>("/api", {
      fetch: fetchMock as unknown as typeof fetch,
    });

    expect(result.data[0]!.date).toBeInstanceOf(Date);
  });

  it("sends resolved headers and credentials", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      response(JSON.stringify(SuperJSON.stringify(page()))),
    );

    await transportFetch("/api", {
      fetch: fetchMock as unknown as typeof fetch,
      headers: async () => ({ authorization: "Bearer token" }),
      credentials: "include",
    });

    const [, init] = fetchMock.mock.calls[0]!;
    expect(init).toMatchObject({
      headers: { authorization: "Bearer token" },
      credentials: "include",
    });
  });

  it("forwards the abort signal", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      response(JSON.stringify(SuperJSON.stringify(page()))),
    );

    await transportFetch(
      "/api",
      { fetch: fetchMock as unknown as typeof fetch },
      { signal: controller.signal },
    );

    const [, init] = fetchMock.mock.calls[0]!;
    expect(init?.signal).toBe(controller.signal);
  });

  it("throws DataTableFetchError on a non-2xx response instead of parsing it", async () => {
    const fetchMock = vi.fn(async () =>
      response("<html>Internal Server Error</html>", {
        status: 500,
        statusText: "Internal Server Error",
      }),
    );

    const error = await transportFetch("/api/logs", {
      fetch: fetchMock as unknown as typeof fetch,
    }).catch((e) => e);

    expect(error).toBeInstanceOf(DataTableFetchError);
    expect(error.status).toBe(500);
    expect(error.url).toBe("/api/logs");
    expect(error.body).toContain("Internal Server Error");
  });

  it("throws DataTableFetchError when the body cannot be parsed", async () => {
    const fetchMock = vi.fn(async () => response("not json at all"));

    const error = await transportFetch("/api/logs", {
      fetch: fetchMock as unknown as typeof fetch,
    }).catch((e) => e);

    expect(error).toBeInstanceOf(DataTableFetchError);
    expect(error.message).toContain("Could not parse");
    expect(error.cause).toBeDefined();
  });
});

// ── Parsers ─────────────────────────────────────────────────────────────────

describe("parsers", () => {
  it("jsonParser takes the body verbatim", async () => {
    const parsed = await jsonParser<{ date: string }[], unknown>()(
      response(JSON.stringify(page({ data: [{ date: "2024-01-01" }] }))),
    );
    expect(parsed.data[0]!.date).toBe("2024-01-01");
  });

  it("superjsonParser revives Dates", async () => {
    const parsed = await superjsonParser<{ at: Date }[], unknown>()(
      response(
        JSON.stringify(
          SuperJSON.stringify(page({ data: [{ at: new Date(0) }] })),
        ),
      ),
    );
    expect(parsed.data[0]!.at).toBeInstanceOf(Date);
  });

  it("schemaJsonParser revives timestamp columns from ISO strings", async () => {
    const parse = schemaJsonParser<Record<string, unknown>[], unknown>({
      columns: [
        { key: "date", kind: "timestamp" },
        { key: "host", kind: "string" },
      ],
    });

    const parsed = await parse(
      response(
        JSON.stringify(
          page({ data: [{ date: "2024-01-01T00:00:00.000Z", host: "a.com" }] }),
        ),
      ),
    );

    expect(parsed.data[0]!.date).toBeInstanceOf(Date);
    expect((parsed.data[0]!.date as Date).toISOString()).toBe(
      "2024-01-01T00:00:00.000Z",
    );
    // A string column that happens to parse as a date is left alone.
    expect(parsed.data[0]!.host).toBe("a.com");
  });

  it("schemaJsonParser is a pass-through when the schema has no timestamps", async () => {
    const parse = schemaJsonParser<Record<string, unknown>[], unknown>({
      columns: [{ key: "host", kind: "string" }],
    });
    const parsed = await parse(
      response(JSON.stringify(page({ data: [{ host: "a.com" }] }))),
    );
    expect(parsed.data[0]!.host).toBe("a.com");
  });
});

describe("timestampKeys", () => {
  it("collects only timestamp columns", () => {
    expect(
      timestampKeys({
        columns: [
          { key: "date", kind: "timestamp" },
          { key: "host", kind: "string" },
          { key: "seen", kind: "timestamp" },
          { key: "unknown" },
        ],
      }),
    ).toEqual(["date", "seen"]);
  });
});

describe("coerceRowTimestamps", () => {
  it("converts ISO strings and epoch numbers", () => {
    const row = coerceRowTimestamps(
      { a: "2024-01-01T00:00:00.000Z", b: 1704067200000 },
      ["a", "b"],
    );
    expect(row.a).toBeInstanceOf(Date);
    expect(row.b).toBeInstanceOf(Date);
  });

  it("leaves an existing Date untouched", () => {
    const date = new Date(0);
    expect(coerceRowTimestamps({ a: date }, ["a"]).a).toBe(date);
  });

  it("leaves an unparseable value rather than producing Invalid Date", () => {
    expect(coerceRowTimestamps({ a: "not a date" }, ["a"]).a).toBe(
      "not a date",
    );
    expect(coerceRowTimestamps({ a: null }, ["a"]).a).toBeNull();
    expect(coerceRowTimestamps({ a: "" }, ["a"]).a).toBe("");
  });

  it("reads and writes dotted key paths", () => {
    const row = coerceRowTimestamps(
      { timing: { dns: "2024-01-01T00:00:00.000Z" } },
      ["timing.dns"],
    );
    expect(row.timing.dns).toBeInstanceOf(Date);
  });

  it("ignores a dotted path whose parent is missing", () => {
    const row = coerceRowTimestamps({ other: 1 } as Record<string, unknown>, [
      "timing.dns",
    ]);
    expect(row).toEqual({ other: 1 });
  });
});

// ── Pagination strategies ───────────────────────────────────────────────────

describe("timestampCursorPagination", () => {
  const strategy = timestampCursorPagination();

  it("starts at the search cursor when there is one", () => {
    const at = new Date("2024-06-01T00:00:00.000Z");
    expect(strategy.getInitialPageParam({ cursor: at })).toEqual({
      cursor: at.getTime(),
      direction: "next",
    });
  });

  it("starts at now when there is no cursor", () => {
    const before = Date.now();
    const param = strategy.getInitialPageParam({});
    expect(param.cursor).toBeGreaterThanOrEqual(before);
    expect(param.direction).toBe("next");
  });

  it("pages forwards and backwards from the response cursors", () => {
    expect(
      strategy.getNextPageParam(page({ nextCursor: 100 }), {
        cursor: 200,
        direction: "next",
      }),
    ).toEqual({ cursor: 100, direction: "next" });

    expect(
      strategy.getPreviousPageParam(page({ prevCursor: 300 }), {
        cursor: 200,
        direction: "next",
      }),
    ).toEqual({ cursor: 300, direction: "prev" });
  });

  it("ends the list when the server sends no cursor", () => {
    const param = { cursor: 1, direction: "next" as const };
    expect(strategy.getNextPageParam(page(), param)).toBeNull();
    expect(strategy.getPreviousPageParam(page(), param)).toBeNull();
  });

  it("writes the cursor back as a Date", () => {
    const applied = strategy.applyPageParam(
      { host: "a.com" },
      { cursor: 1704067200000, direction: "prev" },
    );
    expect(applied.cursor).toBeInstanceOf(Date);
    expect((applied.cursor as Date).getTime()).toBe(1704067200000);
    expect(applied.direction).toBe("prev");
    expect(applied.host).toBe("a.com");
  });

  it("owns the cursor and direction keys", () => {
    expect(strategy.pageParamKeys).toEqual(["cursor", "direction"]);
  });

  it("honours renamed keys", () => {
    const renamed = timestampCursorPagination({
      cursorKey: "after",
      directionKey: "dir",
    });
    expect(renamed.pageParamKeys).toEqual(["after", "dir"]);
    const applied = renamed.applyPageParam(
      {},
      { cursor: 0, direction: "next" },
    );
    expect(applied.after).toBeInstanceOf(Date);
    expect(applied.dir).toBe("next");
  });
});

describe("opaqueCursorPagination", () => {
  const strategy = opaqueCursorPagination();

  it("echoes the server cursor verbatim", () => {
    expect(strategy.getNextPageParam(page({ nextCursor: 42 }), null)).toBe(42);
  });

  it("is forward-only", () => {
    expect(
      strategy.getPreviousPageParam(page({ prevCursor: 1 }), null),
    ).toBeNull();
  });

  it("starts from null when the search carries no cursor", () => {
    expect(strategy.getInitialPageParam({})).toBeNull();
  });

  it("applies the cursor under its key", () => {
    expect(strategy.applyPageParam({ q: "x" }, "abc")).toEqual({
      q: "x",
      cursor: "abc",
    });
  });
});

describe("offsetPagination", () => {
  const strategy = offsetPagination({ size: 3 });

  it("starts at zero", () => {
    expect(strategy.getInitialPageParam({})).toBe(0);
  });

  it("prefers the server's nextCursor as the next offset", () => {
    expect(strategy.getNextPageParam(page({ nextCursor: 30 }), 0)).toBe(30);
  });

  it("accumulates the offset across pages when the server sends no cursor", () => {
    const full = page({ data: [1, 2, 3] });
    expect(strategy.getNextPageParam(full, 0)).toBe(3);
    expect(strategy.getNextPageParam(full, 3)).toBe(6);
  });

  it("stops on a short page", () => {
    expect(strategy.getNextPageParam(page({ data: [1, 2] }), 3)).toBeNull();
    expect(strategy.getNextPageParam(page({ data: [] }), 3)).toBeNull();
  });

  it("applies offset and a default size", () => {
    expect(strategy.applyPageParam({ q: "x" }, 6)).toEqual({
      q: "x",
      offset: 6,
      size: 3,
    });
  });

  it("does not override a size already in the search state", () => {
    expect(strategy.applyPageParam({ size: 50 }, 0)).toEqual({
      offset: 0,
      size: 50,
    });
  });

  it("owns only the offset key, so size stays in the cache key", () => {
    expect(strategy.pageParamKeys).toEqual(["offset"]);
  });
});

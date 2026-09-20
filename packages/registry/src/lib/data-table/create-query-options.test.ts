import { QueryClient } from "@tanstack/react-query";
import { createSerializer, parseAsArrayOf, parseAsString } from "nuqs/server";
import SuperJSON from "superjson";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createDataTableQueryOptions,
  getMetaPage,
  refreshDataTableQuery,
  resetPagesForRefresh,
  type InfiniteQueryResponse,
} from "./create-query-options";
import { offsetPagination, type PaginationStrategy } from "./transport";

type Row = { id: number };

function page(
  overrides: Partial<InfiniteQueryResponse<Row[], unknown>> = {},
): InfiniteQueryResponse<Row[], unknown> {
  return {
    data: [],
    meta: {
      totalRowCount: 0,
      filterRowCount: 0,
      chartData: [],
      facets: {},
    },
    prevCursor: null,
    nextCursor: null,
    ...overrides,
  };
}

/** Serializer that only knows about declared keys, like an allow-list nuqs serializer. */
const serializer = (search: Record<string, unknown>) => {
  const params = new URLSearchParams();
  for (const key of ["host", "cursor"]) {
    const value = search[key];
    if (value === null || value === undefined) continue;
    params.set(
      key,
      value instanceof Date ? String(value.getTime()) : String(value),
    );
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
};

/**
 * The page param wraps the pagination strategy's own param: the strategy owns
 * `page`, and `_meta` sits outside it because meta skipping is a transport
 * concern that has to work whatever addresses the pages.
 */
function cursorParam(_meta: boolean) {
  return { page: { cursor: 1, direction: "next" as const }, _meta };
}

async function fetchUrlFor({
  skipMetaOnPagination,
  pageParam,
  searchParamsSerializer = serializer,
  pagination,
  search = { host: "example.com" },
}: {
  search?: Record<string, unknown>;
  skipMetaOnPagination?: boolean;
  pageParam: { page: unknown; _meta: boolean };
  searchParamsSerializer?: (search: Record<string, unknown>) => string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pagination?: PaginationStrategy<any>;
}) {
  const spy = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(
      new Response(JSON.stringify(SuperJSON.stringify(page()))),
    );

  const options = createDataTableQueryOptions<Row[], unknown>({
    queryKeyPrefix: "test",
    apiEndpoint: "/api",
    searchParamsSerializer,
    skipMetaOnPagination,
    ...(pagination ? { pagination } : {}),
  })(search);

  // @ts-expect-error -- queryFn is invoked directly, without the query client
  await options.queryFn({ pageParam });
  return String(spy.mock.calls[0][0]);
}

afterEach(() => vi.restoreAllMocks());

describe("createDataTableQueryOptions — meta skipping", () => {
  it("appends _meta=false to pagination requests when opted in", async () => {
    const url = await fetchUrlFor({
      skipMetaOnPagination: true,
      pageParam: cursorParam(false),
    });
    expect(url).toContain("_meta=false");
  });

  it("does not append _meta on the initial page", async () => {
    const url = await fetchUrlFor({
      skipMetaOnPagination: true,
      pageParam: cursorParam(true),
    });
    expect(url).not.toContain("_meta");
  });

  it("does not append _meta at all when not opted in (default)", async () => {
    const url = await fetchUrlFor({
      pageParam: cursorParam(false),
    });
    expect(url).not.toContain("_meta");
  });

  // Regression: routing _meta through the serializer let an allow-list
  // serializer silently drop it, so pagination still paid for full aggregation.
  it("survives a serializer that drops unknown keys", async () => {
    const url = await fetchUrlFor({
      skipMetaOnPagination: true,
      pageParam: cursorParam(false),
      searchParamsSerializer: () => "?host=example.com",
    });
    expect(url).toMatch(/\/api\?host=example\.com&_meta=false$/);
  });

  // `_meta` sits outside the strategy's page param precisely so it survives a
  // strategy whose param is a bare number rather than an object.
  it("works with a pagination strategy whose page param is not an object", async () => {
    const url = await fetchUrlFor({
      skipMetaOnPagination: true,
      pagination: offsetPagination({ size: 10 }),
      pageParam: { page: 20, _meta: false },
    });
    expect(url).toContain("_meta=false");
  });

  it("uses ? when the serializer produced no query string", async () => {
    const url = await fetchUrlFor({
      skipMetaOnPagination: true,
      pageParam: cursorParam(false),
      searchParamsSerializer: () => "",
    });
    expect(url).toMatch(/\/api\?_meta=false$/);
  });
});

describe("createDataTableQueryOptions — request url", () => {
  const nuqsSerializer = createSerializer({
    level: parseAsArrayOf(parseAsString),
    region: parseAsArrayOf(parseAsString),
    host: parseAsString,
  }) as (search: Record<string, unknown>) => string;

  // Regression: only the cache key was normalized, so every untouched array
  // filter reached the request as an empty `key=` param.
  it("drops empty array filters from the request", async () => {
    const url = await fetchUrlFor({
      pageParam: cursorParam(true),
      searchParamsSerializer: nuqsSerializer,
      search: { level: ["warning"], region: [], host: null },
    });
    expect(url).toMatch(/\/api\?level=warning$/);
  });
});

describe("getMetaPage", () => {
  it("returns undefined without data", () => {
    expect(getMetaPage(undefined)).toBeUndefined();
    expect(getMetaPage({ pages: [], pageParams: [] })).toBeUndefined();
  });

  it("returns the page fetched with _meta: true", () => {
    const initial = page({ meta: { ...page().meta, totalRowCount: 42 } });
    const next = page();
    expect(
      getMetaPage({
        pages: [initial, next],
        pageParams: [{ _meta: true }, { _meta: false }],
      }),
    ).toBe(initial);
  });

  // Regression: live mode prepends via fetchPreviousPage, so the meta page is
  // not at index 0 — and the prepended page carries an empty meta payload.
  it("finds the meta page after pages are prepended", () => {
    const initial = page({ meta: { ...page().meta, totalRowCount: 42 } });
    const prepended = page();
    expect(
      getMetaPage({
        pages: [prepended, initial],
        pageParams: [{ _meta: false }, { _meta: true }],
      }),
    ).toBe(initial);
  });

  // Regression: inferring the meta page from a non-empty chartData picked the
  // wrong page whenever a filter legitimately matched nothing.
  it("still finds the meta page when it has no chart data", () => {
    const empty = page();
    const later = page();
    expect(
      getMetaPage({
        pages: [empty, later],
        pageParams: [{ _meta: true }, { _meta: false }],
      }),
    ).toBe(empty);
  });

  it("falls back to the last page when no param is flagged", () => {
    const first = page();
    const last = page();
    expect(getMetaPage({ pages: [first, last], pageParams: [{}, {}] })).toBe(
      last,
    );
  });
});

describe("resetPagesForRefresh", () => {
  const fresh = {
    page: { cursor: 9, direction: "next" as const },
    _meta: true,
  };

  it("returns undefined for an empty cache", () => {
    expect(resetPagesForRefresh(undefined, fresh)).toBeUndefined();
    expect(resetPagesForRefresh({ pages: [], pageParams: [] }, fresh)).toBe(
      undefined,
    );
  });

  it("replaces the first param and keeps the rest", () => {
    const initial = page({ data: [{ id: 1 }] });
    const next = page({ data: [{ id: 2 }] });
    const nextParam = cursorParam(false);
    expect(
      resetPagesForRefresh(
        { pages: [initial, next], pageParams: [cursorParam(true), nextParam] },
        fresh,
      ),
    ).toEqual({ pages: [initial, next], pageParams: [fresh, nextParam] });
  });

  // Regression: live mode prepends "prev" pages, so the first param is a
  // backward cursor. Refetching from it wiped the list.
  it("drops pages prepended before the meta page", () => {
    const live = page({ data: [{ id: 0 }] });
    const initial = page({ data: [{ id: 1 }] });
    const next = page({ data: [{ id: 2 }] });
    const prevParam = {
      page: { cursor: 5, direction: "prev" as const },
      _meta: false,
    };
    const nextParam = cursorParam(false);
    expect(
      resetPagesForRefresh(
        {
          pages: [live, live, initial, next],
          pageParams: [prevParam, prevParam, cursorParam(true), nextParam],
        },
        fresh,
      ),
    ).toEqual({ pages: [initial, next], pageParams: [fresh, nextParam] });
  });

  it("keeps everything when no param is flagged", () => {
    const first = page({ data: [{ id: 1 }] });
    const second = page({ data: [{ id: 2 }] });
    const unflagged = {
      pages: [first, second],
      pageParams: [cursorParam(false), cursorParam(false)],
    };
    expect(resetPagesForRefresh(unflagged, fresh)).toEqual({
      pages: [first, second],
      pageParams: [fresh, cursorParam(false)],
    });
  });
});

describe("refreshDataTableQuery", () => {
  /**
   * An endpoint over a fixed set of rows keyed by timestamp, paging two rows
   * at a time — enough to load pages forward, prepend a "prev" page the way
   * live mode does, and see what a refetch makes of it.
   */
  function setup(rows: number[]) {
    const requests: string[] = [];
    const fetchMock = vi.fn(async (url: string) => {
      requests.push(url);
      const params = new URL(url, "http://localhost").searchParams;
      const cursor = Number(params.get("cursor"));
      const direction = params.get("direction");
      const data =
        direction === "prev"
          ? rows.filter((t) => t > cursor).map((t) => ({ id: t }))
          : rows
              .filter((t) => t < cursor)
              .sort((a, b) => b - a)
              .slice(0, 2)
              .map((t) => ({ id: t }));
      const body: InfiniteQueryResponse<Row[], unknown> = page({
        data,
        nextCursor: data.length ? data[data.length - 1].id : null,
        prevCursor: data.length ? data[0].id : cursor,
      });
      return new Response(JSON.stringify(SuperJSON.stringify(body)));
    });
    const serialize = (search: Record<string, unknown>) => {
      const params = new URLSearchParams();
      for (const key of ["cursor", "direction"]) {
        const value = search[key];
        if (value === null || value === undefined) continue;
        params.set(
          key,
          value instanceof Date ? String(value.getTime()) : String(value),
        );
      }
      return `?${params.toString()}`;
    };
    const options = createDataTableQueryOptions<Row[], unknown>({
      queryKeyPrefix: "rows",
      apiEndpoint: "/api",
      searchParamsSerializer: serialize,
      skipMetaOnPagination: true,
      transport: { fetch: fetchMock as unknown as typeof fetch },
    });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    return { client, options, requests };
  }

  const ids = (client: QueryClient, key: readonly unknown[]) =>
    (
      client.getQueryData(key) as { pages: InfiniteQueryResponse<Row[]>[] }
    ).pages.flatMap((p) => p.data.map((r) => r.id));

  it("bare refetch after live mode restarts from the prepended param", async () => {
    const { client, options, requests } = setup([10, 20, 30, 40, 50]);
    const opts = options({ cursor: new Date(45) });
    await client.prefetchInfiniteQuery({ ...opts, pages: 2 });
    expect(ids(client, opts.queryKey)).toEqual([40, 30, 20, 10]);

    const query = client.getQueryCache().find({ queryKey: opts.queryKey })!;
    // Live mode's tick: a backward fetch that finds nothing new.
    await query.fetch(undefined, {
      meta: { fetchMore: { direction: "backward" } },
    });
    expect(ids(client, opts.queryKey)).toEqual([50, 40, 30, 20, 10]);
    await query.fetch(undefined, {
      meta: { fetchMore: { direction: "backward" } },
    });
    expect(ids(client, opts.queryKey)).toEqual([50, 40, 30, 20, 10]);

    requests.length = 0;
    await client.refetchQueries({ queryKey: opts.queryKey, exact: true });
    // The refetch re-requests the (empty) prev page, finds no next cursor, and
    // stops — the list is gone. This is the bug the helper exists for.
    expect(requests).toHaveLength(1);
    expect(requests[0]).toContain("direction=prev");
    expect(ids(client, opts.queryKey)).toEqual([]);
  });

  it("reloads the same number of pages from a fresh initial param", async () => {
    const { client, options, requests } = setup([10, 20, 30, 40, 50]);
    const opts = options({ cursor: new Date(45) });
    await client.prefetchInfiniteQuery({ ...opts, pages: 2 });
    const query = client.getQueryCache().find({ queryKey: opts.queryKey })!;
    await query.fetch(undefined, {
      meta: { fetchMore: { direction: "backward" } },
    });
    await query.fetch(undefined, {
      meta: { fetchMore: { direction: "backward" } },
    });
    expect(ids(client, opts.queryKey)).toEqual([50, 40, 30, 20, 10]);

    requests.length = 0;
    // A refresh builds the options again, so the initial cursor is "now".
    await refreshDataTableQuery(client, options({ cursor: new Date(60) }));

    expect(requests).toHaveLength(2);
    expect(requests[0]).toContain("cursor=60");
    expect(requests[0]).toContain("direction=next");
    expect(requests[0]).not.toContain("_meta=false");
    expect(requests[1]).toContain("_meta=false");
    expect(ids(client, opts.queryKey)).toEqual([50, 40, 30, 20]);

    const data = client.getQueryData(opts.queryKey) as {
      pages: InfiniteQueryResponse<Row[]>[];
      pageParams: unknown[];
    };
    expect(getMetaPage(data)).toBe(data.pages[0]);
  });

  it("keeps the loaded rows on screen while the refetch is in flight", async () => {
    const { client, options } = setup([10, 20, 30, 40, 50]);
    const opts = options({ cursor: new Date(45) });
    await client.prefetchInfiniteQuery({ ...opts, pages: 2 });
    const query = client.getQueryCache().find({ queryKey: opts.queryKey })!;
    await query.fetch(undefined, {
      meta: { fetchMore: { direction: "backward" } },
    });
    expect(ids(client, opts.queryKey)).toEqual([50, 40, 30, 20, 10]);

    const pending = refreshDataTableQuery(
      client,
      options({ cursor: new Date(60) }),
    );
    // Synchronously after the call: the prepended live page is gone, the
    // originally loaded pages are still there, and the meta page is index 0.
    expect(ids(client, opts.queryKey)).toEqual([40, 30, 20, 10]);
    const data = client.getQueryData(opts.queryKey) as {
      pages: InfiniteQueryResponse<Row[]>[];
      pageParams: unknown[];
    };
    expect(getMetaPage(data)).toBe(data.pages[0]);
    expect(query.state.fetchStatus).toBe("fetching");

    await pending;
    expect(ids(client, opts.queryKey)).toEqual([50, 40, 30, 20]);
  });

  it("is a no-op reset on an empty cache", async () => {
    const { client, options, requests } = setup([10, 20]);
    const opts = options({ cursor: new Date(30) });
    await refreshDataTableQuery(client, opts);
    // Nothing cached under the key, so nothing to refetch either.
    expect(requests).toHaveLength(0);
    expect(client.getQueryData(opts.queryKey)).toBeUndefined();
  });

  // The reset and `getMetaPage` both key off `_meta: true`. A hand-built
  // param without it would refetch a list that never carries meta, so it is
  // rejected up front instead of degrading silently.
  it("rejects an initial page param that is not flagged as the meta page", () => {
    const { client, options } = setup([10, 20]);
    const opts = options({ cursor: new Date(30) });
    expect(() =>
      refreshDataTableQuery(client, {
        queryKey: opts.queryKey,
        initialPageParam: { ...opts.initialPageParam, _meta: false },
      }),
    ).toThrow(/_meta: true/);
  });
});

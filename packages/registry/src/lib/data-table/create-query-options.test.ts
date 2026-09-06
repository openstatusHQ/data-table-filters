import SuperJSON from "superjson";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createDataTableQueryOptions,
  getMetaPage,
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
}: {
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
  })({ host: "example.com" });

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

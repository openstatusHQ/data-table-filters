import type { ActionDescriptor } from "@dtf/registry/lib/actions/types";
import { infiniteQueryOptions, keepPreviousData } from "@tanstack/react-query";
import SuperJSON from "superjson";
import type { BaseChartSchema, FacetMetadataSchema } from "./types";

export type InfiniteQueryMeta<TMeta = Record<string, unknown>> = {
  totalRowCount: number;
  filterRowCount: number;
  chartData: BaseChartSchema[];
  facets: Record<string, FacetMetadataSchema>;
  /**
   * What can be done to these rows. Rendered as-is by the `data-table-actions`
   * block; the server owns the list (see `createActionHandler`).
   */
  actions?: ActionDescriptor[];
  metadata?: TMeta;
};

export type InfiniteQueryResponse<TData, TMeta = unknown> = {
  data: TData;
  meta: InfiniteQueryMeta<TMeta>;
  prevCursor: number | null;
  nextCursor: number | null;
};

function getBaseUrl() {
  if (typeof window !== "undefined") return "";
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

/**
 * Factory for creating infinite query options for data tables.
 *
 * Parametrizes the query key prefix, API endpoint, and serializer —
 * everything else (pagination, caching, SuperJSON) is shared.
 */
export function createDataTableQueryOptions<TData, TMeta>(config: {
  queryKeyPrefix: string;
  apiEndpoint: string;
  searchParamsSerializer: (search: Record<string, unknown>) => string;
  /**
   * Append `_meta=false` to pagination requests so the API can skip recomputing
   * chart data and facets that the client already holds from the initial page.
   *
   * Opt-in, and only safe when both halves are in place:
   * 1. the route honors `_meta=false` (and still returns per-row fields — only
   *    `meta` is skippable), and
   * 2. the client reads `meta` via `getMetaPage`, not from the last page.
   *
   * @default false
   */
  skipMetaOnPagination?: boolean;
}) {
  return (search: Record<string, unknown>) => {
    const cursor = search.cursor as Date | undefined;
    const initialCursor = cursor?.getTime?.() ?? Date.now();

    // Normalize empty arrays to null for consistent serialization
    const normalized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(search)) {
      if (Array.isArray(value) && value.length === 0) {
        normalized[key] = null;
      } else {
        normalized[key] = value;
      }
    }

    const stableKey = config.searchParamsSerializer({
      ...normalized,
      uuid: null,
      live: null,
      cursor: null,
      direction: null,
    });

    return infiniteQueryOptions({
      queryKey: [config.queryKeyPrefix, stableKey],
      queryFn: async ({ pageParam }) => {
        const cursorDate = new Date(pageParam.cursor);
        const direction = pageParam.direction as "next" | "prev" | undefined;
        const serialize = config.searchParamsSerializer({
          ...search,
          cursor: cursorDate,
          direction,
          uuid: null,
          live: null,
        });

        // Appended after serialization on purpose: `_meta` is a transport-level
        // control param, not part of any consumer's search-param schema. Routing
        // it through the serializer would either pollute every consumer's parser
        // contract or be silently dropped by an allow-list serializer.
        const url = `${getBaseUrl()}${config.apiEndpoint}${serialize}`;
        const skipMeta = config.skipMetaOnPagination && !pageParam._meta;
        const response = await fetch(
          skipMeta ? `${url}${url.includes("?") ? "&" : "?"}_meta=false` : url,
        );
        const json = await response.json();
        return SuperJSON.parse<InfiniteQueryResponse<TData, TMeta>>(json);
      },
      initialPageParam: {
        cursor: initialCursor,
        direction: "next",
        _meta: true,
      },
      getPreviousPageParam: (firstPage) => {
        if (!firstPage.prevCursor) return null;
        return {
          cursor: firstPage.prevCursor,
          direction: "prev",
          _meta: false,
        };
      },
      getNextPageParam: (lastPage) => {
        if (!lastPage.nextCursor) return null;
        return {
          cursor: lastPage.nextCursor,
          direction: "next",
          _meta: false,
        };
      },
      refetchOnWindowFocus: false,
      placeholderData: keepPreviousData,
      staleTime: 1000 * 60 * 5,
    });
  };
}

/**
 * The page whose `meta` is populated.
 *
 * With `skipMetaOnPagination`, only the page fetched with `_meta: true` carries
 * chart data, facets and metadata — and it is not always index 0, because
 * `fetchPreviousPage` (live mode) prepends pages. React Query keeps `pageParams`
 * aligned with `pages`, so the flag on the page param identifies it exactly.
 * Inferring it from the payload instead (e.g. "the page whose chartData is
 * non-empty") misfires whenever a filter legitimately matches nothing.
 *
 * Falls back to the last page, which is the correct answer when meta skipping is
 * off and every page carries the same meta.
 */
export function getMetaPage<TData, TMeta>(
  data:
    | { pages: InfiniteQueryResponse<TData, TMeta>[]; pageParams: unknown[] }
    | undefined,
): InfiniteQueryResponse<TData, TMeta> | undefined {
  if (!data?.pages?.length) return undefined;
  const index = data.pageParams.findIndex(
    (param) => (param as { _meta?: boolean } | null)?._meta,
  );
  return data.pages[index] ?? data.pages[data.pages.length - 1];
}

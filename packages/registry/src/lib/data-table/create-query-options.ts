import type { ActionDescriptor } from "@dtf/registry/lib/actions/types";
import { infiniteQueryOptions, keepPreviousData } from "@tanstack/react-query";
import type { PaginationStrategy, Transport } from "./transport";
import {
  resolveUrl,
  timestampCursorPagination,
  transportFetch,
} from "./transport";
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

/**
 * Search keys that address a single row or a view mode rather than a filter.
 * They are cleared from both the request and the cache key so that opening a
 * row's sheet does not refetch the list under a new key.
 */
const DEFAULT_OMIT_KEYS = ["uuid", "live"] as const;

export type DataTableQueryOptionsConfig<TData, TMeta> = {
  queryKeyPrefix: string;
  apiEndpoint: string;
  searchParamsSerializer: (search: Record<string, unknown>) => string;
  /**
   * How to reach the endpoint: base URL, headers, credentials, and how to parse
   * the body. Omitted, it stays what it always was — same-origin `fetch` and a
   * SuperJSON payload.
   */
  transport?: Transport<TData, TMeta>;
  /**
   * How pages are addressed. Defaults to a bidirectional cursor over a
   * timestamp column, which is what a log table wants; see
   * `offsetPagination` and `opaqueCursorPagination` for endpoints that page
   * some other way.
   */
  // `any` on the page param is deliberate: the param type is existential — the
  // strategy owns it and nothing else in this config refers to it, so surfacing
  // it as a third generic would force every call site that names `TData` and
  // `TMeta` to name it too, just to keep the default.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pagination?: PaginationStrategy<any>;
  /** Extra search keys to clear from the request and the cache key. */
  omitKeys?: readonly string[];
  /** Overrides merged into the generated `infiniteQueryOptions`. */
  queryOptions?: {
    staleTime?: number;
    gcTime?: number;
    refetchOnWindowFocus?: boolean;
    retry?: number | boolean;
  };
};

/**
 * Factory for creating infinite query options for data tables.
 *
 * Parametrizes the query key prefix, endpoint, serializer, transport, and
 * pagination — everything else (caching, the stable key, page-param plumbing)
 * is shared.
 */
export function createDataTableQueryOptions<TData, TMeta>(
  config: DataTableQueryOptionsConfig<TData, TMeta>,
) {
  const pagination = config.pagination ?? timestampCursorPagination();
  // Both the request and the cache key drop these. Kept as a plain object so
  // spreading it cannot be reordered into a no-op by a later key.
  const cleared: Record<string, null> = {};
  for (const key of [...DEFAULT_OMIT_KEYS, ...(config.omitKeys ?? [])]) {
    cleared[key] = null;
  }

  return (search: Record<string, unknown>) => {
    const initialPageParam = pagination.getInitialPageParam(search);

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
      ...cleared,
      // The page param is not part of the identity of the list — every page of
      // one filter state belongs under one key.
      ...Object.fromEntries(pagination.pageParamKeys.map((key) => [key, null])),
    });

    return infiniteQueryOptions({
      queryKey: [config.queryKeyPrefix, stableKey],
      queryFn: async ({ pageParam, signal }) => {
        const serialize = config.searchParamsSerializer({
          ...pagination.applyPageParam(search, pageParam),
          ...cleared,
        });
        return transportFetch<TData, TMeta>(
          resolveUrl(config.transport, `${config.apiEndpoint}${serialize}`),
          config.transport,
          { signal },
        );
      },
      initialPageParam,
      getPreviousPageParam: (firstPage, _allPages, firstPageParam) =>
        pagination.getPreviousPageParam(firstPage, firstPageParam),
      getNextPageParam: (lastPage, _allPages, lastPageParam) =>
        pagination.getNextPageParam(lastPage, lastPageParam),
      refetchOnWindowFocus: config.queryOptions?.refetchOnWindowFocus ?? false,
      placeholderData: keepPreviousData,
      staleTime: config.queryOptions?.staleTime ?? 1000 * 60 * 5,
      ...(config.queryOptions?.gcTime !== undefined
        ? { gcTime: config.queryOptions.gcTime }
        : {}),
      ...(config.queryOptions?.retry !== undefined
        ? { retry: config.queryOptions.retry }
        : {}),
    });
  };
}

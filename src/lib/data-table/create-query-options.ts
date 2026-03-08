import { infiniteQueryOptions, keepPreviousData } from "@tanstack/react-query";
import SuperJSON from "superjson";
import type { BaseChartSchema, FacetMetadataSchema } from "./types";

export type InfiniteQueryMeta<TMeta = Record<string, unknown>> = {
  totalRowCount: number;
  filterRowCount: number;
  chartData: BaseChartSchema[];
  facets: Record<string, FacetMetadataSchema>;
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
        const response = await fetch(
          `${getBaseUrl()}${config.apiEndpoint}${serialize}`,
        );
        const json = await response.json();
        return SuperJSON.parse<InfiniteQueryResponse<TData, TMeta>>(json);
      },
      initialPageParam: { cursor: initialCursor, direction: "next" },
      getPreviousPageParam: (firstPage) => {
        if (!firstPage.prevCursor) return null;
        return { cursor: firstPage.prevCursor, direction: "prev" };
      },
      getNextPageParam: (lastPage) => {
        if (!lastPage.nextCursor) return null;
        return { cursor: lastPage.nextCursor, direction: "next" };
      },
      refetchOnWindowFocus: false,
      placeholderData: keepPreviousData,
      staleTime: 1000 * 60 * 5,
    });
  };
}

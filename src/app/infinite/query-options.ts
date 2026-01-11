import type { Percentile } from "@/lib/request/percentile";
import { infiniteQueryOptions, keepPreviousData } from "@tanstack/react-query";
import SuperJSON from "superjson";
import type {
  BaseChartSchema,
  ColumnSchema,
  FacetMetadataSchema,
} from "./schema";
import { searchParamsSerializer, type SearchParamsType } from "./search-params";

function getBaseUrl() {
  if (typeof window !== "undefined") return ""; // browser should use relative url
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`; // SSR on Vercel
  return `http://localhost:${process.env.PORT ?? 3000}`; // dev SSR
}

export type LogsMeta = {
  currentPercentiles: Record<Percentile, number>;
};

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

// Query key = filters only (no cursor/pagination state)
// This ensures server/client keys match regardless of when they run
// We normalize empty arrays to null to ensure consistent serialization
// between server (where nuqs returns null) and client (where schema defaults to [])
function getStableQueryKey(search: SearchParamsType) {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(search)) {
    // Normalize empty arrays to null for consistent serialization
    if (Array.isArray(value) && value.length === 0) {
      normalized[key] = null;
    } else {
      normalized[key] = value;
    }
  }
  return searchParamsSerializer({
    ...normalized,
    uuid: null,
    live: null,
    cursor: null,
    direction: null,
  } as SearchParamsType);
}

export const dataOptions = (search: SearchParamsType) => {
  // cursor undefined = "now", otherwise use the URL value
  const initialCursor = search.cursor?.getTime() ?? Date.now();

  return infiniteQueryOptions({
    queryKey: ["data-table", getStableQueryKey(search)],
    queryFn: async ({ pageParam }) => {
      const cursor = new Date(pageParam.cursor);
      const direction = pageParam.direction as "next" | "prev" | undefined;
      const serialize = searchParamsSerializer({
        ...search,
        cursor,
        direction,
        uuid: null,
        live: null,
      });
      const response = await fetch(`${getBaseUrl()}/infinite/api${serialize}`);
      const json = await response.json();
      return SuperJSON.parse<InfiniteQueryResponse<ColumnSchema[], LogsMeta>>(
        json,
      );
    },
    initialPageParam: { cursor: initialCursor, direction: "next" },
    getPreviousPageParam: (firstPage, _pages) => {
      if (!firstPage.prevCursor) return null;
      return { cursor: firstPage.prevCursor, direction: "prev" };
    },
    getNextPageParam: (lastPage, _pages) => {
      if (!lastPage.nextCursor) return null;
      return { cursor: lastPage.nextCursor, direction: "next" };
    },
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

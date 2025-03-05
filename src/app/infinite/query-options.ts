import type {
  ColumnSchema,
  FacetMetadataSchema,
  BaseChartSchema,
} from "./schema";
import { type SearchParamsType, searchParamsSerializer } from "./search-params";
import { infiniteQueryOptions, keepPreviousData } from "@tanstack/react-query";
import type { Percentile } from "@/lib/request/percentile";
import SuperJSON from "superjson";

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

export type InfiniteQueryResponse<TData = ColumnSchema[]> = {
  data: TData;
  meta: InfiniteQueryMeta<LogsMeta>;
  prevCursor: number | null;
  nextCursor: number | null;
};

export const dataOptions = (search: SearchParamsType) => {
  return infiniteQueryOptions({
    queryKey: [
      "data-table",
      searchParamsSerializer({ ...search, uuid: null, live: null }),
    ], // remove uuid/live as it would otherwise retrigger a fetch
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
      const response = await fetch(`/infinite/api${serialize}`);
      const json = await response.json();
      return SuperJSON.parse<InfiniteQueryResponse<ColumnSchema[]>>(json);
    },
    initialPageParam: { cursor: new Date().getTime(), direction: "next" },
    getPreviousPageParam: (firstGroup, _groups) => {
      if (!firstGroup.prevCursor) return null;
      return { cursor: firstGroup.prevCursor, direction: "prev" };
    },
    getNextPageParam: (lastGroup, _groups) => {
      if (!lastGroup.nextCursor) return null;
      return { cursor: lastGroup.nextCursor, direction: "next" };
    },
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });
};

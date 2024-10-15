import type { MakeArray } from "@/types";
import { ColumnSchema } from "./schema";
import { SearchParamsType, searchParamsSerializer } from "./search-params";
import { infiniteQueryOptions, keepPreviousData } from "@tanstack/react-query";
import { Percentile } from "@/lib/request/percentile";

export type InfiniteQueryMeta = {
  totalRowCount: number;
  filterRowCount: number;
  totalFilters: MakeArray<ColumnSchema>;
  currentPercentiles: Record<Percentile, number>;
  chartData: { timestamp: number; [key: string]: number }[];
};

export const dataOptions = (search: SearchParamsType) => {
  return infiniteQueryOptions({
    queryKey: ["data-table", searchParamsSerializer({ ...search, uuid: null })], // remove uuid as it would otherwise retrigger a fetch
    queryFn: async ({ pageParam = 0 }) => {
      const start = (pageParam as number) * search.size;
      const serialize = searchParamsSerializer({ ...search, start });
      const response = await fetch(`/infinite/api${serialize}`);
      return response.json() as Promise<{
        data: ColumnSchema[];
        meta: InfiniteQueryMeta;
      }>;
    },
    initialPageParam: 0,
    getNextPageParam: (_lastGroup, groups) => groups.length,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });
};

import type { MakeArray } from "@/types";
import { ColumnSchema } from "./schema";
import { SearchParamsType, searchParamsSerializer } from "./search-params";
import { infiniteQueryOptions, keepPreviousData } from "@tanstack/react-query";

export type InfiniteQueryMeta = {
  totalRowCount: number;
  filterRowCount: number;
  totalFilters: MakeArray<ColumnSchema>;
};

export const dataOptions = (search: SearchParamsType) => {
  return infiniteQueryOptions({
    queryKey: ["data-table", searchParamsSerializer({ ...search, uuid: null })], // remove uuid as it would otherwise retrigger a fetch
    queryFn: async ({ pageParam = 0 }) => {
      const start = (pageParam as number) * search.size;
      const serialize = searchParamsSerializer({ ...search, start });
      const response = await fetch(`/i/api${serialize}`);
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

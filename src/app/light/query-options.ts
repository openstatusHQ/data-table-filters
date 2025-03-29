import type { InfiniteQueryResponse } from "@/app/infinite/query-options";
import { infiniteQueryOptions, keepPreviousData } from "@tanstack/react-query";
import SuperJSON from "superjson";
import { searchParamsSerializer, type SearchParamsType } from "./search-params";
import type { ColumnType } from "./types";

export const dataOptions = (search: SearchParamsType) => {
  return infiniteQueryOptions({
    queryKey: [
      "data-table-light",
      searchParamsSerializer({ ...search, uuid: null }),
    ],
    queryFn: async ({ pageParam }) => {
      const cursor = new Date(pageParam.cursor);
      const direction = pageParam.direction as "next" | "prev" | undefined;
      const serialize = searchParamsSerializer({
        ...search,
        cursor,
        direction,
      });
      const response = await fetch(`/light/api${serialize}`);
      const json = await response.json();

      return SuperJSON.parse<InfiniteQueryResponse<ColumnType[]>>(json);
    },
    initialPageParam: { cursor: new Date().getTime(), direction: "next" },
    // REMINDER: removed the getPreviousPageParam as we are not using live mode
    getNextPageParam: (lastPage, _pages) => {
      if (!lastPage.nextCursor) return null;
      return { cursor: lastPage.nextCursor, direction: "next" };
    },
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });
};

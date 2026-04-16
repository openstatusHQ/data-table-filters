import type { InfiniteQueryResponse } from "@/app/infinite/query-options";
import { infiniteQueryOptions, keepPreviousData } from "@tanstack/react-query";
import SuperJSON from "superjson";
import type { ColumnType } from "./columns";
import { searchParamsSerializer, type SearchParamsType } from "./search-params";

// Normalize state to ensure consistent query keys between server and client
// Server (nuqs parse) returns null for arrays, client (schema defaults) returns []
function getStableQueryKey(search: SearchParamsType) {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(search)) {
    if (Array.isArray(value) && value.length === 0) {
      normalized[key] = null;
    } else {
      normalized[key] = value;
    }
  }
  return searchParamsSerializer({
    ...normalized,
    uuid: null,
  } as SearchParamsType);
}

export const dataOptions = (search: SearchParamsType) => {
  return infiniteQueryOptions({
    queryKey: ["data-table-light", getStableQueryKey(search)],
    queryFn: async ({ pageParam }) => {
      const cursor = new Date(pageParam.cursor);
      const direction = pageParam.direction as "next" | "prev" | undefined;
      const serialize = searchParamsSerializer({
        ...search,
        cursor,
        direction,
      });
      const response = await fetch(`/light/api${serialize}`);

      if (!response.ok) {
        throw new Error("Network response was not ok, check base URL");
      }

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
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

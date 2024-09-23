import type { MakeArray } from "@/types";
import { ColumnSchema } from "./schema";
import { parseAsSort } from "./search-params";
import { infiniteQueryOptions, keepPreviousData } from "@tanstack/react-query";

const FETCH_SIZE = 20;

export const dataOptions = ({
  sort,
}: {
  // TODO: pass `search` object here!
  sort?: { id: string; desc: boolean } | null;
}) => {
  const serializedSort = sort ? parseAsSort.serialize(sort) : "";
  // TODO: we can serialize the sort object within here! - OR EVEN THE ENTIRE SEARCH OBJECT
  return infiniteQueryOptions({
    queryKey: ["data-table", sort],
    queryFn: async ({ pageParam = 0 }) => {
      const start = (pageParam as number) * FETCH_SIZE;
      const response = await fetch(
        `/infinite/api?start=${start}&size=${FETCH_SIZE}&sort=${serializedSort}`
      );
      return response.json() as Promise<{
        data: ColumnSchema[];
        meta: {
          totalRowCount: number;
          currentFilters: MakeArray<ColumnSchema>;
        };
      }>;
    },
    initialPageParam: 0,
    getNextPageParam: (_lastGroup, groups) => groups.length,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });
};

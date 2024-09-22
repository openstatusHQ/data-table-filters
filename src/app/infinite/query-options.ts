import { ColumnSchema } from "@/_data-table/schema";
import { parseAsSort } from "@/_data-table/search-params";
import { infiniteQueryOptions, keepPreviousData } from "@tanstack/react-query";

const FETCH_SIZE = 10;

export const dataOptions = ({
  sort,
}: {
  sort?: { id: string; desc: boolean } | null;
}) => {
  const serializedSort = sort ? parseAsSort.serialize(sort) : "";
  // TODO: we can serialize the sort object within here!
  return infiniteQueryOptions({
    queryKey: ["data-table", sort],
    queryFn: async ({ pageParam = 0 }) => {
      const start = (pageParam as number) * FETCH_SIZE;
      const response = await fetch(
        `/api/data?start=${start}&size=${FETCH_SIZE}&sort=${serializedSort}`
      );
      return response.json() as Promise<{
        data: ColumnSchema[];
        meta: { totalRowCount: number };
      }>;
    },
    initialPageParam: 0,
    getNextPageParam: (_lastGroup, groups) => groups.length,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });
};

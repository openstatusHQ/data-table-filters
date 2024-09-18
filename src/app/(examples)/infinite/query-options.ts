import { ColumnSchema } from "@/_data-table/schema";
import { infiniteQueryOptions, keepPreviousData } from "@tanstack/react-query";

const FETCH_SIZE = 10;

export const dataOptions = infiniteQueryOptions({
  queryKey: ["data-table"],
  queryFn: async ({ pageParam = 0 }) => {
    const start = (pageParam as number) * FETCH_SIZE;
    const response = await fetch(`/api/data?start=${start}&size=${FETCH_SIZE}`);
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

import type { BuilderDataResponse } from "@/app/api/builder/data/route";
import { infiniteQueryOptions, keepPreviousData } from "@tanstack/react-query";

const PAGE_SIZE = 30;

function getStableFilterKey(
  filters: Record<string, unknown>,
  sort: { id: string; desc: boolean } | null,
): string {
  return JSON.stringify({ filters, sort });
}

export const builderDataOptions = (
  dataId: string,
  filters: Record<string, unknown>,
  sort: { id: string; desc: boolean } | null,
) => {
  return infiniteQueryOptions({
    queryKey: [
      "builder-data",
      dataId,
      getStableFilterKey(filters, sort),
    ] as const,
    queryFn: async ({ pageParam }) => {
      const response = await fetch("/api/builder/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataId,
          filters,
          sort,
          offset: pageParam,
          size: PAGE_SIZE,
        }),
      });
      if (!response.ok) {
        throw new Error("Failed to fetch builder data");
      }
      return (await response.json()) as BuilderDataResponse;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 5,
  });
};

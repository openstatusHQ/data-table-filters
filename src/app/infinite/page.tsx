import { getQueryClient } from "@/providers/get-query-client";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { SearchParams } from "nuqs";
import { Client } from "./client";
import { dataOptions } from "./query-options";
import { searchParamsCache } from "./search-params";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const search = await searchParamsCache.parse(searchParams);
  const queryClient = getQueryClient();
  await queryClient.prefetchInfiniteQuery(dataOptions(search));

  const dehydratedState = dehydrate(queryClient);

  return (
    <HydrationBoundary state={dehydratedState}>
      <Client />
    </HydrationBoundary>
  );
}

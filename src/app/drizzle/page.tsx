import { getQueryClient } from "@/providers/get-query-client";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { SearchParams } from "nuqs";
import { Client } from "./client";
import { searchParamsCache } from "./search-params";

// Force dynamic rendering to avoid caching issues
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const search = await searchParamsCache.parse(searchParams);
  return (
    <HydrationBoundary state={dehydrate(getQueryClient())}>
      <Client initialState={search} />
    </HydrationBoundary>
  );
}

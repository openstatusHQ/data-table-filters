import { PREFETCH_COOKIE_NAME } from "@/lib/constants/cookies";
import { getQueryClient } from "@/providers/get-query-client";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { cookies } from "next/headers";
import type { SearchParams } from "nuqs";
import { Suspense } from "react";
import { Client } from "./client";
import { dataOptions } from "./query-options";
import { searchParamsCache, SearchParamsType } from "./search-params";
import { Skeleton } from "./skeleton";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const search = await searchParamsCache.parse(searchParams);
  const cookieStore = await cookies();
  // NOTE: for showcase purpose, we use PREFETCH_COOKIE_NAME "false" to disable prefetch
  // because our query is slow and it's nicer UX to render a loading state instead of a skeleton
  // but we can enable it any time we want by toggling the cookie value
  const prefetchEnabled =
    cookieStore.get(PREFETCH_COOKIE_NAME)?.value === "true";

  if (prefetchEnabled) {
    // Same as loading.tsx except that we *only** render the Skeleton based on the prefetch state
    return (
      <Suspense fallback={<Skeleton />}>
        <PrefetchedContent search={search} />
      </Suspense>
    );
  }

  // No prefetch: render client directly without Suspense/skeleton
  return (
    <HydrationBoundary state={dehydrate(getQueryClient())}>
      <Client />
    </HydrationBoundary>
  );
}

async function PrefetchedContent({ search }: { search: SearchParamsType }) {
  const queryClient = getQueryClient();
  await queryClient.prefetchInfiniteQuery(dataOptions(search));

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Client />
    </HydrationBoundary>
  );
}

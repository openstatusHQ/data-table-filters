import * as React from "react";
import { searchParamsCache } from "@/_data-table/search-params";
import { getQueryClient } from "@/providers/get-query-client";
import { dataOptions } from "./query-options";
import { InfiniteTable } from "./infinite-table";

export default function Page({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const search = searchParamsCache.parse(searchParams);
  const queryClient = getQueryClient();

  void queryClient.prefetchInfiniteQuery(dataOptions);

  return <InfiniteTable />;
}

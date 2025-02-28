import * as React from "react";
import { searchParamsCache } from "./search-params";
import { getQueryClient } from "@/providers/get-query-client";
import { dataOptions } from "./query-options";
import { Client } from "./client";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const search = searchParamsCache.parse(await searchParams);
  const queryClient = getQueryClient();
  await queryClient.prefetchInfiniteQuery(dataOptions(search));

  return <Client />;
}

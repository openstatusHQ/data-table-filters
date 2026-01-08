import { getQueryClient } from "@/providers/get-query-client";
import * as React from "react";
import { Client } from "./client";
import { dataOptions } from "./query-options";
import { searchParamsCache } from "./search-params";

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

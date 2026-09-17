import type { SearchParams as RawSearchParams } from "nuqs";
import { Client } from "./client";
import { searchParamsCache } from "./schema";

/**
 * Parses the URL on the server so the first render already has the filters,
 * the sort and the cursor — no flash of an unfiltered table.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const search = await searchParamsCache.parse(searchParams);
  return <Client initialState={search} />;
}

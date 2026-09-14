"use client";

import {
  fetchTableManifest,
  type FetchManifestOptions,
  type TableManifest,
} from "@dtf/registry/lib/table-schema";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

/**
 * Load a table's manifest.
 *
 * ## Why this is separate from the data query
 *
 * The manifest cannot be fetched alongside the rows, because everything that
 * fetches rows is *built from* it: the columns, the filter fields, and — the
 * binding constraint — the URL-state adapter, whose parsers are derived from
 * the schema. `useNuqsAdapter(schema, …)` needs a schema at first render, and a
 * hook cannot be called conditionally, so the manifest has to resolve one level
 * up from anything that consumes it.
 *
 * That is why the headless table is two components: an outer one that resolves
 * the manifest, and an inner one that is only mounted once it has. This hook is
 * the outer half.
 *
 * ## Avoiding the waterfall
 *
 * A round trip for the manifest before the first row request is a real cost.
 * Two ways out, both supported by `initialManifest`:
 *
 * - **Snapshot at build time.** Check the manifest into the app and pass it.
 *   The query still revalidates in the background, so a schema change on the
 *   server is picked up without a redeploy, but nothing blocks on it.
 * - **Prefetch on the server.** `fetchTableManifest` on the server component and
 *   hand the result down, or seed the React Query cache under `tableManifestKey`.
 *
 * With `initialManifest` the hook never suspends and the table renders on the
 * first paint.
 */

/** The query key a manifest is cached under. Exported so a server can seed it. */
export function tableManifestKey(endpoint: string) {
  return ["data-table-manifest", endpoint] as const;
}

export type UseTableManifestOptions = FetchManifestOptions & {
  /**
   * A manifest that is already known — a build-time snapshot, or one prefetched
   * on the server. Used as the initial value; the query still revalidates.
   */
  initialManifest?: TableManifest;
  /**
   * How long a manifest stays fresh. Schemas change on deploy, not per request,
   * so this is long by default.
   */
  staleTime?: number;
  /** Set false to render only from `initialManifest` and never fetch. */
  enabled?: boolean;
  /**
   * Retries before the query gives up. Defaults to 1: a malformed manifest is
   * not transient — retrying cannot repair the endpoint's answer — but a single
   * retry still covers a dropped connection.
   */
  retry?: number | boolean;
};

const FIVE_MINUTES = 1000 * 60 * 5;

export function useTableManifest(
  endpoint: string,
  options?: UseTableManifestOptions,
): UseQueryResult<TableManifest, Error> {
  const {
    initialManifest,
    staleTime = FIVE_MINUTES,
    enabled = true,
    retry = 1,
    ...fetchOptions
  } = options ?? {};

  return useQuery<TableManifest, Error>({
    queryKey: tableManifestKey(endpoint),
    queryFn: ({ signal }) =>
      fetchTableManifest(endpoint, { ...fetchOptions, signal }),
    ...(initialManifest ? { initialData: initialManifest } : {}),
    enabled,
    staleTime,
    retry,
    refetchOnWindowFocus: false,
  });
}

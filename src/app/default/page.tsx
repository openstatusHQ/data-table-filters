import { ADAPTER_COOKIE_NAME } from "@/lib/constants/cookies";
import type { AdapterType } from "@/lib/store";
import { cookies } from "next/headers";
import * as React from "react";
import { Client } from "./client";
import { columns } from "./columns";
import { filterFields } from "./constants";
import { data } from "./data";
import { Skeleton } from "./skeleton";

/**
 * Default route - supports both nuqs (URL) and Zustand (client-side) adapters
 *
 * Toggle between adapters using the configuration dropdown in the sidebar.
 * - nuqs: Filter state synced to URL params (shareable, browser history)
 * - zustand: Filter state kept client-side only
 */
export default async function Page() {
  const cookieStore = await cookies();
  const adapterType =
    (cookieStore.get(ADAPTER_COOKIE_NAME)?.value as AdapterType) || "nuqs";

  return (
    <React.Suspense fallback={<Skeleton />}>
      <Client
        columns={columns}
        data={data}
        filterFields={filterFields}
        defaultAdapterType={adapterType}
      />
    </React.Suspense>
  );
}

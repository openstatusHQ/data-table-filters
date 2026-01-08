import * as React from "react";
import { columns } from "./columns";
import { filterFields } from "./constants";
import { data } from "./data";
import { DataTable } from "./data-table";
import { Skeleton } from "./skeleton";

/**
 * Default route - uses Zustand for client-side state management
 *
 * Note: This route does NOT sync filter state with URL params.
 * For URL-based state, see the /infinite or /light routes which use nuqs.
 */
export default function Page() {
  return (
    <React.Suspense fallback={<Skeleton />}>
      <DataTable columns={columns} data={data} filterFields={filterFields} />
    </React.Suspense>
  );
}

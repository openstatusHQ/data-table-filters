import { columns } from "@/app/(default)/columns";
import { data, filterFields } from "@/app/(default)/constants";
import { DataTable } from "@/app/(default)/data-table";
import { searchParamsCache } from "@/app/(default)/search-params";
import { Skeleton } from "./skeleton";

import * as React from "react";

export default function Page({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const search = searchParamsCache.parse(searchParams);

  return (
    <React.Suspense fallback={<Skeleton />}>
      <DataTable
        columns={columns}
        data={data}
        filterFields={filterFields}
        defaultColumnFilters={Object.entries(search)
          .map(([key, value]) => ({
            id: key,
            value,
          }))
          .filter(({ value }) => value ?? undefined)}
      />
    </React.Suspense>
  );
}

import { columns } from "./columns";
import { data, filterFields } from "./constants";
import { DataTable } from "./data-table";
import { searchParamsCache } from "./search-params";
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

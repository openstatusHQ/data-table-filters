import { columns } from "@/_data-table/columns";
import { data, filterFields } from "@/_data-table/constants";
import { DataTable } from "@/_data-table/data-table";
import { searchParamsCache } from "@/_data-table/search-params";
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

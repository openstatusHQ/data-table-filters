"use client";

import * as React from "react";
import { DataTableInfinite } from "./data-table-infinite";
import { columns } from "@/_data-table/columns";
import { filterFields } from "@/_data-table/constants";
import { useQueryStates } from "nuqs";
import { searchParamsParser } from "@/_data-table/search-params";
import { useInfiniteQuery } from "@tanstack/react-query";
import { dataOptions } from "./query-options";

export function Client() {
  const [search] = useQueryStates(searchParamsParser);
  const { data, isFetching, isLoading, fetchNextPage } =
    useInfiniteQuery(dataOptions);

  const flatData = React.useMemo(
    () => data?.pages?.flatMap((page) => page.data ?? []) ?? [],
    [data]
  );

  const totalDBRowCount = data?.pages?.[0]?.meta?.totalRowCount;
  const totalFetched = flatData?.length;

  return (
    <DataTableInfinite
      columns={columns}
      data={flatData}
      totalRows={totalDBRowCount}
      totalRowsFetched={totalFetched}
      defaultColumnFilters={Object.entries(search)
        .map(([key, value]) => ({
          id: key,
          value,
        }))
        .filter(({ value }) => value ?? undefined)}
      filterFields={filterFields}
      isFetching={isFetching}
      isLoading={isLoading}
      fetchNextPage={fetchNextPage}
    />
  );
}

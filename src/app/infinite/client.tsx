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
  // TODO: pass the `search` object to the `dataOptions` function
  const { data, isFetching, isLoading, fetchNextPage } = useInfiniteQuery(
    dataOptions({ sort: search.sort })
  );

  const flatData = React.useMemo(
    () => data?.pages?.flatMap((page) => page.data ?? []) ?? [],
    [data]
  );

  const totalDBRowCount = data?.pages?.[0]?.meta?.totalRowCount;
  const totalFetched = flatData?.length;

  const { sort, start, size, ...filter } = search;

  return (
    <DataTableInfinite
      columns={columns}
      // REMINDER: we cannot use `flatData` due to memoization?!?!?
      data={data?.pages?.flatMap((page) => page.data ?? []) ?? []}
      totalRows={totalDBRowCount}
      totalRowsFetched={totalFetched}
      defaultColumnFilters={Object.entries(filter)
        .map(([key, value]) => ({
          id: key,
          value,
        }))
        .filter(({ value }) => value ?? undefined)}
      defaultColumnSorting={sort ? [sort] : undefined}
      filterFields={filterFields}
      isFetching={isFetching}
      isLoading={isLoading}
      fetchNextPage={fetchNextPage}
    />
  );
}

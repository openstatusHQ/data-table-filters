"use client";

import * as React from "react";
import { DataTableInfinite } from "./data-table-infinite";
import { columns } from "./columns";
import { filterFields } from "./constants";
import { useQueryStates } from "nuqs";
import { searchParamsParser } from "./search-params";
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
  const currentFilters = data?.pages?.[0]?.meta?.currentFilters;
  const totalFetched = flatData?.length;

  const { sort, start, size, ...filter } = search;

  console.log(search);

  const _filterFields = React.useMemo(
    () =>
      filterFields.map((field) => {
        if (field.value === "latency" || field.value === "status") {
          field.options =
            currentFilters?.[field.value].map((value) => ({
              label: `${value}`,
              value,
            })) ?? field.options;
        }
        return field;
      }),
    [currentFilters]
  );

  return (
    <DataTableInfinite
      columns={columns}
      // REMINDER: we cannot use `flatData` due to memoization?!?!?
      //   MAYBE: this will be resolved if we add queryKey(search) as the search is unique and will trigger a change of data
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
      filterFields={_filterFields}
      isFetching={isFetching}
      isLoading={isLoading}
      fetchNextPage={fetchNextPage}
    />
  );
}

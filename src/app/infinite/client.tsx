"use client";

import * as React from "react";
import { DataTableInfinite } from "./data-table-infinite";
import { columns } from "./columns";
import { filterFields as defaultFilterFields } from "./constants";
import { useQueryStates } from "nuqs";
import { searchParamsParser } from "./search-params";
import { useInfiniteQuery } from "@tanstack/react-query";
import { dataOptions } from "./query-options";

export function Client() {
  const [search] = useQueryStates(searchParamsParser);
  const { data, isFetching, isLoading, fetchNextPage } = useInfiniteQuery(
    dataOptions(search)
  );

  const flatData = React.useMemo(
    () => data?.pages?.flatMap((page) => page.data ?? []) ?? [],
    [data?.pages]
  );

  const lastPage = data?.pages?.[data?.pages.length - 1];
  const totalDBRowCount = lastPage?.meta?.totalRowCount;
  const filterDBRowCount = lastPage?.meta?.filterRowCount;
  const totalFilters = lastPage?.meta?.totalFilters;
  const currentPercentiles = lastPage?.meta?.currentPercentiles;
  const chartData = lastPage?.meta?.chartData;
  const totalFetched = flatData?.length;

  const { sort, start, size, uuid, ...filter } = search;

  const filterFields = React.useMemo(
    () =>
      defaultFilterFields.map((field) => {
        if (
          field.value === "latency" ||
          field.value === "timing.dns" ||
          field.value === "timing.connection" ||
          field.value === "timing.tls" ||
          field.value === "timing.ttfb" ||
          field.value === "timing.transfer" ||
          field.value === "status"
        ) {
          field.options =
            totalFilters?.[field.value].map((value) => ({
              label: `${value}`,
              value,
            })) ?? field.options;
        }
        if (field.value === "host" || field.value === "pathname") {
          field.options =
            totalFilters?.[field.value].map((value) => ({
              label: `${value}`,
              value,
            })) ?? field.options;
        }
        return field;
      }),
    [totalFilters]
  );

  return (
    <DataTableInfinite
      columns={columns}
      data={flatData}
      totalRows={totalDBRowCount}
      filterRows={filterDBRowCount}
      totalRowsFetched={totalFetched}
      currentPercentiles={currentPercentiles}
      defaultColumnFilters={Object.entries(filter)
        .map(([key, value]) => ({
          id: key,
          value,
        }))
        .filter(({ value }) => value ?? undefined)}
      defaultColumnSorting={sort ? [sort] : undefined}
      defaultRowSelection={search.uuid ? { [search.uuid]: true } : undefined}
      filterFields={filterFields}
      isFetching={isFetching}
      isLoading={isLoading}
      fetchNextPage={fetchNextPage}
      chartData={chartData}
    />
  );
}

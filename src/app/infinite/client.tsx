"use client";

import * as React from "react";
import { DataTableInfinite } from "./data-table-infinite";
import { columns } from "./columns";
import { filterFields as defaultFilterFields } from "./constants";
import { useQueryStates } from "nuqs";
import { searchParamsParser } from "./search-params";
import { useInfiniteQuery } from "@tanstack/react-query";
import { dataOptions } from "./query-options";
import { useHotKey } from "@/hooks/use-hot-key";

export function Client() {
  const [search] = useQueryStates(searchParamsParser);
  const { data, isFetching, isLoading, fetchNextPage } = useInfiniteQuery(
    dataOptions(search)
  );

  useHotKey(() => {
    // FIXME: some dedicated div[tabindex="0"] do not auto-unblur (e.g. the DataTableFilterResetButton)
    // document.activeElement?.blur();
    document.body.setAttribute("tabindex", "0");
    document.body.focus();
    document.body.removeAttribute("tabindex");
  }, ".");

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
      getRowClassName={(row) => {
        if (row.original.result === "success") return "";
        return "bg-destructive/5 hover:bg-destructive/10 data-[state=selected]:bg-destructive/10 focus-visible:bg-destructive/10";
      }}
      getRowId={(row) => row.uuid}
    />
  );
}

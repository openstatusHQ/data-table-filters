"use client";

import { getLevelRowClassName } from "@/lib/request/level";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useQueryStates } from "nuqs";
import * as React from "react";
import { DataTableInfinite } from "../infinite/data-table-infinite";
import { columns } from "./columns";
import { filterFields as defaultFilterFields, sheetFields } from "./constants";
import { dataOptions } from "./query-options";
import { searchParamsParser } from "./search-params";

export function Client() {
  const [search] = useQueryStates(searchParamsParser);
  const { data, isFetching, isLoading, fetchNextPage, refetch } =
    useInfiniteQuery(dataOptions(search));

  const flatData = React.useMemo(
    () => data?.pages?.flatMap((page) => page.data ?? []) ?? [],
    [data?.pages],
  );

  const lastPage = data?.pages?.[data?.pages.length - 1];
  const totalDBRowCount = lastPage?.meta?.totalRowCount;
  const filterDBRowCount = lastPage?.meta?.filterRowCount;
  const metadata = lastPage?.meta?.metadata;
  const chartData = lastPage?.meta?.chart;
  const facets = lastPage?.meta?.facets;
  const totalFetched = flatData?.length;

  const { sort, cursor, direction, uuid, ...filter } = search;

  const filterFields = React.useMemo(() => {
    return defaultFilterFields.map((field) => {
      const facet = facets?.[field.value];
      if (facet) {
        // TODO: facets
      }
      return field;
    });
  }, [flatData]);

  return (
    <DataTableInfinite
      columns={columns}
      data={flatData}
      totalRows={totalDBRowCount}
      filterRows={filterDBRowCount}
      totalRowsFetched={totalFetched}
      defaultColumnFilters={Object.entries(filter)
        .map(([key, value]) => ({
          id: key,
          value,
        }))
        .filter(({ value }) => value ?? undefined)}
      defaultColumnSorting={sort ? [sort] : undefined}
      getRowClassName={(row) => getLevelRowClassName(row.original.level)}
      meta={metadata}
      chartData={chartData}
      chartDataColumnId="timestamp"
      filterFields={filterFields}
      sheetFields={sheetFields}
      isFetching={isFetching}
      isLoading={isLoading}
      fetchNextPage={fetchNextPage}
      // NOTE: we are not using live mode
      fetchPreviousPage={undefined}
      refetch={refetch}
      renderSheetTitle={(props) => props.row?.original.url}
    />
  );
}

"use client";

import * as React from "react";
import { DataTableInfinite } from "./data-table-infinite";
import { columns } from "./columns";
import { filterFields as defaultFilterFields, sheetFields } from "./constants";
import { useQueryStates } from "nuqs";
import { searchParamsParser } from "./search-params";
import { useInfiniteQuery } from "@tanstack/react-query";
import { dataOptions } from "./query-options";
import { useHotKey } from "@/hooks/use-hot-key";
import { getLevelRowClassName } from "@/lib/request/level";
import type { FacetMetadataSchema } from "./schema";
import type { Table as TTable } from "@tanstack/react-table";

export function Client() {
  const [search] = useQueryStates(searchParamsParser);
  const { data, isFetching, isLoading, fetchNextPage } = useInfiniteQuery(
    dataOptions(search)
  );
  useResetFocus();

  const flatData = React.useMemo(
    () => data?.pages?.flatMap((page) => page.data ?? []) ?? [],
    [data?.pages]
  );

  // REMINDER: meta data is always the same for all pages as filters do not change(!)
  const lastPage = data?.pages?.[data?.pages.length - 1];
  const totalDBRowCount = lastPage?.meta?.totalRowCount;
  const filterDBRowCount = lastPage?.meta?.filterRowCount;
  const metadata = lastPage?.meta?.metadata;
  const chartData = lastPage?.meta?.chartData;
  const facets = lastPage?.meta?.facets;
  const totalFetched = flatData?.length;

  const { sort, start, size, uuid, ...filter } = search;

  // REMINDER: this is currently needed for the cmdk search
  // TODO: auto search via API when the user changes the filter instead of hardcoded
  const filterFields = defaultFilterFields.map((field) => {
    const facetsField = facets?.[field.value];
    if (!facetsField) return field;
    if (field.options && field.options.length > 0) return field;

    // REMINDER: if no options are set, we need to set them via the API
    const options = facetsField.rows.map(({ value }) => {
      return {
        label: `${value}`,
        value,
      };
    });

    if (field.type === "slider") {
      return {
        ...field,
        min: facetsField.min ?? field.min,
        max: facetsField.max ?? field.max,
        options,
      };
    }

    return { ...field, options };
  });

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
      defaultRowSelection={search.uuid ? { [search.uuid]: true } : undefined}
      // FIXME: make it configurable - TODO: use `columnHidden: boolean` in `filterFields`
      defaultColumnVisibility={{
        uuid: false,
        "timing.dns": false,
        "timing.connection": false,
        "timing.tls": false,
        "timing.ttfb": false,
        "timing.transfer": false,
      }}
      meta={metadata}
      filterFields={filterFields}
      sheetFields={sheetFields}
      isFetching={isFetching}
      isLoading={isLoading}
      fetchNextPage={fetchNextPage}
      chartData={chartData}
      getRowClassName={(row) => getLevelRowClassName(row.original.level)}
      getRowId={(row) => row.uuid}
      getFacetedUniqueValues={getFacetedUniqueValues(facets)}
      getFacetedMinMaxValues={getFacetedMinMaxValues(facets)}
    />
  );
}

function useResetFocus() {
  useHotKey(() => {
    // FIXME: some dedicated div[tabindex="0"] do not auto-unblur (e.g. the DataTableFilterResetButton)
    // REMINDER: we cannot just document.activeElement?.blur(); as the next tab will focus the next element in line,
    // which is not what we want. We want to reset entirely.
    document.body.setAttribute("tabindex", "0");
    document.body.focus();
    document.body.removeAttribute("tabindex");
  }, ".");
}

function getFacetedUniqueValues<TData>(
  facets?: Record<string, FacetMetadataSchema>
) {
  return (_: TTable<TData>, columnId: string): Map<string, number> => {
    return new Map(
      facets?.[columnId]?.rows?.map(({ value, total }) => [value, total]) || []
    );
  };
}

function getFacetedMinMaxValues<TData>(
  facets?: Record<string, FacetMetadataSchema>
) {
  return (_: TTable<TData>, columnId: string): [number, number] | undefined => {
    const min = facets?.[columnId]?.min;
    const max = facets?.[columnId]?.max;
    if (min && max) return [min, max];
    if (min) return [min, min];
    if (max) return [max, max];
    return undefined;
  };
}

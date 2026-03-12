"use client";

import { DataTableInfinite } from "@/components/data-table/data-table-infinite";
import { LiveRow } from "@/components/data-table/data-table-infinite/live-row";
import { timingPhasesColumn } from "@/components/data-table/data-table-infinite/timing-phases-column";
import { useHotKey } from "@/hooks/use-hot-key";
import { useLiveMode } from "@/hooks/use-live-mode";
import {
  getFacetedMinMaxValues,
  getFacetedUniqueValues,
} from "@/lib/data-table/faceted";
import { getLevelRowClassName } from "@/lib/request/level";
import { DataTableStoreProvider, useFilterState } from "@/lib/store";
import { useNuqsAdapter } from "@/lib/store/adapters/nuqs";
import {
  generateColumns,
  generateFilterFields,
  generateSheetFields,
  getDefaultColumnVisibility,
} from "@/lib/table-schema";
import { cn } from "@/lib/utils";
import { useInfiniteQuery } from "@tanstack/react-query";
import * as React from "react";
import { dataOptions } from "./query-options";
import type { ColumnSchema, FilterState } from "./schema";
import { filterSchema } from "./schema";
import { tableSchema } from "./table-schema";

const columns = [
  ...generateColumns<ColumnSchema>(tableSchema.definition),
  timingPhasesColumn,
];

const filterFields = generateFilterFields<ColumnSchema>(tableSchema.definition);
const sheetFields = generateSheetFields<ColumnSchema>(tableSchema.definition);
const defaultColumnVisibility = getDefaultColumnVisibility(
  tableSchema.definition,
);

export function Client() {
  useResetFocus();

  const adapter = useNuqsAdapter(filterSchema.definition, { id: "drizzle" });

  return (
    <DataTableStoreProvider adapter={adapter}>
      <ClientInner />
    </DataTableStoreProvider>
  );
}

function ClientInner() {
  const search = useFilterState<FilterState>();

  const {
    data,
    isFetching,
    isLoading,
    fetchNextPage,
    hasNextPage,
    fetchPreviousPage,
    refetch,
  } = useInfiniteQuery(dataOptions(search));

  const flatData = React.useMemo(
    () => data?.pages?.flatMap((page) => page.data ?? []) ?? [],
    [data?.pages],
  );

  const liveMode = useLiveMode(flatData);

  const lastPage = data?.pages?.[data?.pages.length - 1];
  const totalDBRowCount = lastPage?.meta?.totalRowCount;
  const filterDBRowCount = lastPage?.meta?.filterRowCount;
  const metadata = lastPage?.meta?.metadata;
  const chartData = lastPage?.meta?.chartData;
  const facets = lastPage?.meta?.facets;
  const totalFetched = flatData?.length;

  const { sort, start, size, uuid, cursor, direction, live, ...filter } =
    search;

  const dynamicFilterFields = React.useMemo(() => {
    return filterFields.map((field) => {
      const facetsField = facets?.[field.value as string];
      if (!facetsField) return field;
      if (field.options && field.options.length > 0) return field;

      const options = facetsField.rows.map(({ value }) => ({
        label: `${value}`,
        value,
      }));

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
  }, [facets]);

  const defaultColumnFilters = React.useMemo(() => {
    return Object.entries(filter)
      .map(([key, value]) => ({
        id: key,
        value,
      }))
      .filter(({ value }) => {
        if (value === null || value === undefined) return false;
        if (Array.isArray(value) && value.length === 0) return false;
        return true;
      });
  }, [filter]);

  return (
    <DataTableInfinite
      columns={columns}
      data={flatData}
      totalRows={totalDBRowCount}
      filterRows={filterDBRowCount}
      totalRowsFetched={totalFetched}
      defaultColumnFilters={defaultColumnFilters}
      defaultColumnSorting={sort ? [sort] : undefined}
      defaultRowSelection={search.uuid ? { [search.uuid]: true } : undefined}
      defaultColumnVisibility={defaultColumnVisibility}
      meta={metadata ?? {}}
      filterFields={dynamicFilterFields}
      sheetFields={sheetFields}
      isFetching={isFetching}
      isLoading={isLoading}
      fetchNextPage={fetchNextPage}
      hasNextPage={hasNextPage}
      fetchPreviousPage={fetchPreviousPage}
      refetch={refetch}
      chartData={chartData}
      chartDataColumnId="date"
      getRowClassName={(row) => {
        const rowTimestamp = row.original.date.getTime();
        const isPast = rowTimestamp <= (liveMode.timestamp || -1);
        const levelClassName = getLevelRowClassName(row.original.level);
        return cn(levelClassName, isPast ? "opacity-50" : "opacity-100");
      }}
      getRowId={(row) => row.uuid}
      getFacetedUniqueValues={getFacetedUniqueValues(facets)}
      getFacetedMinMaxValues={getFacetedMinMaxValues(facets)}
      renderLiveRow={(props) => {
        if (!liveMode.timestamp) return null;
        if (props?.row.original.uuid !== liveMode?.row?.uuid) return null;
        return <LiveRow colSpan={columns.length - 1} />;
      }}
      renderSheetTitle={(props) => props.row?.original.pathname}
      schema={filterSchema.definition}
      adapterType="nuqs"
    />
  );
}

function useResetFocus() {
  useHotKey(() => {
    document.body.setAttribute("tabindex", "0");
    document.body.focus();
    document.body.removeAttribute("tabindex");
  }, ".");
}

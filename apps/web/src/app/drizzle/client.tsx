"use client";

import { LiveButton } from "@/components/data-table/data-table-infinite/live-button";
import { LiveRow } from "@/components/data-table/data-table-infinite/live-row";
import { RefreshButton } from "@/components/data-table/data-table-infinite/refresh-button";
import { SocialsFooter } from "@/components/data-table/data-table-infinite/socials-footer";
import { TimelineChart } from "@/components/data-table/data-table-infinite/timeline-chart";
import { timingPhasesColumn } from "@/components/data-table/data-table-infinite/timing-phases-column";
import { getLevelRowClassName } from "@/lib/request/level";
import { cn } from "@/lib/utils";
import { DataTableFilterAICommand } from "@dtf/registry/components/data-table/data-table-filter-command-ai";
import { DataTableInfinite } from "@dtf/registry/components/data-table/data-table-infinite";
import { useDataTable } from "@dtf/registry/components/data-table/data-table-provider";
import { MemoizedDataTableSheetContent } from "@dtf/registry/components/data-table/data-table-sheet/data-table-sheet-content";
import { DataTableSheetDetails } from "@dtf/registry/components/data-table/data-table-sheet/data-table-sheet-details";
import type { SheetField } from "@dtf/registry/components/data-table/types";
import { useHotKey } from "@dtf/registry/hooks/use-hot-key";
import { useLiveMode } from "@dtf/registry/hooks/use-live-mode";
import {
  getFacetedMinMaxValues,
  getFacetedUniqueValues,
} from "@dtf/registry/lib/data-table/faceted";
import { useNuqsAdapter } from "@dtf/registry/lib/store/adapters/nuqs";
import { useFilterState } from "@dtf/registry/lib/store/hooks/useFilterState";
import { DataTableStoreProvider } from "@dtf/registry/lib/store/provider/DataTableStoreProvider";
import {
  generateColumns,
  generateFilterFields,
  generateSheetFields,
  getDefaultColumnVisibility,
} from "@dtf/registry/lib/table-schema";
import { useInfiniteQuery } from "@tanstack/react-query";
import * as React from "react";
import { dataOptions } from "./query-options";
import type { ColumnSchema, FilterState } from "./schema";
import { filterSchema } from "./schema";
import type { SearchParamsType } from "./search-params";
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

export function Client({ initialState }: { initialState: SearchParamsType }) {
  useResetFocus();

  const adapter = useNuqsAdapter(filterSchema.definition, {
    id: "drizzle",
    initialState,
  });

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

  const { sort, size, uuid, cursor, direction, live, ...filter } = search;

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
      filterFields={dynamicFilterFields}
      isFetching={isFetching}
      isLoading={isLoading}
      fetchNextPage={fetchNextPage}
      hasNextPage={hasNextPage}
      fetchPreviousPage={fetchPreviousPage}
      refetch={refetch}
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
      commandSlot={
        <DataTableFilterAICommand
          schema={filterSchema.definition}
          tableSchema={tableSchema.definition}
          api="/drizzle/api/ai"
          tableId="drizzle"
        />
      }
      toolbarActions={[
        <RefreshButton key="refresh" onClick={refetch} />,
        fetchPreviousPage ? (
          <LiveButton key="live" fetchPreviousPage={fetchPreviousPage} />
        ) : null,
      ]}
      chartSlot={
        <TimelineChart
          data={chartData ?? []}
          className="-mb-2"
          columnId="date"
        />
      }
      footerSlot={
        <SocialsFooter
          showConfigurationDropdown={false}
          prefetchEnabled={false}
          adapterType="nuqs"
        />
      }
      sheetSlot={
        <DrizzleSheetSlot
          sheetFields={sheetFields}
          totalRows={totalDBRowCount ?? 0}
          filterRows={filterDBRowCount ?? 0}
          totalRowsFetched={totalFetched}
          metadata={metadata ?? {}}
        />
      }
      tableId="drizzle"
    />
  );
}

function DrizzleSheetSlot({
  sheetFields: fields,
  totalRows,
  filterRows,
  totalRowsFetched,
  metadata,
}: {
  sheetFields: SheetField<ColumnSchema, any>[];
  totalRows: number;
  filterRows: number;
  totalRowsFetched: number;
  metadata: Record<string, unknown>;
}) {
  const { table, rowSelection, isLoading, filterFields } = useDataTable<
    ColumnSchema,
    unknown
  >();
  const selectedRowKey = Object.keys(rowSelection)?.[0];
  const selectedRow = React.useMemo(() => {
    if (isLoading && !selectedRowKey) return undefined;
    return table
      .getCoreRowModel()
      .flatRows.find((row) => row.id === selectedRowKey);
  }, [selectedRowKey, isLoading, table]);

  return (
    <DataTableSheetDetails
      title={selectedRow?.original.pathname}
      titleClassName="font-mono"
    >
      <MemoizedDataTableSheetContent
        table={table}
        data={selectedRow?.original}
        filterFields={filterFields}
        fields={fields}
        metadata={{
          totalRows,
          filterRows,
          totalRowsFetched,
          ...metadata,
        }}
      />
    </DataTableSheetDetails>
  );
}

function useResetFocus() {
  useHotKey(() => {
    document.body.setAttribute("tabindex", "0");
    document.body.focus();
    document.body.removeAttribute("tabindex");
  }, ".");
}

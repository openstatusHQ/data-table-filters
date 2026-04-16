"use client";

import { DataTableFilterCommand } from "@dtf/registry/components/data-table/data-table-filter-command";
import { DataTableInfinite } from "@dtf/registry/components/data-table/data-table-infinite";
import { SocialsFooter } from "@dtf/registry/components/data-table/data-table-infinite/socials-footer";
import { TimelineChart } from "@dtf/registry/components/data-table/data-table-infinite/timeline-chart";
import { useDataTable } from "@dtf/registry/components/data-table/data-table-provider";
import { MemoizedDataTableSheetContent } from "@dtf/registry/components/data-table/data-table-sheet/data-table-sheet-content";
import { DataTableSheetDetails } from "@dtf/registry/components/data-table/data-table-sheet/data-table-sheet-details";
import {
  getFacetedMinMaxValues,
  getFacetedUniqueValues,
} from "@dtf/registry/lib/data-table/faceted";
import { getLevelRowClassName } from "@/lib/request/level";
import { useNuqsAdapter } from "@dtf/registry/lib/store/adapters/nuqs";
import { useFilterState } from "@dtf/registry/lib/store/hooks/useFilterState";
import { DataTableStoreProvider } from "@dtf/registry/lib/store/provider/DataTableStoreProvider";
import { useInfiniteQuery } from "@tanstack/react-query";
import * as React from "react";
import { columns } from "./columns";
import { filterFields as defaultFilterFields, sheetFields } from "./constants";
import { dataOptions } from "./query-options";
import { filterSchema } from "./schema";
import type { SearchParamsType } from "./search-params";

// Infer FilterState from schema
type FilterState = typeof filterSchema._type;

type ColumnType =
  (typeof columns)[number] extends import("@tanstack/react-table").ColumnDef<
    infer T
  >
    ? T
    : never;

export function Client({ initialState }: { initialState?: SearchParamsType }) {
  const adapter = useNuqsAdapter(filterSchema.definition, {
    id: "light",
    initialState,
  });

  return (
    <DataTableStoreProvider adapter={adapter}>
      <ClientInner />
    </DataTableStoreProvider>
  );
}

// Inner component that can use BYOS hooks (inside provider context)
function ClientInner() {
  // Read full state from adapter for data fetching
  const search = useFilterState<FilterState>();

  const { data, isFetching, isLoading, fetchNextPage, hasNextPage, refetch } =
    useInfiniteQuery(dataOptions(search));

  const flatData = React.useMemo(
    () => data?.pages?.flatMap((page) => page.data ?? []) ?? [],
    [data?.pages],
  );

  const lastPage = data?.pages?.[data?.pages.length - 1];
  const firstPage = data?.pages?.[0];
  const totalDBRowCount = lastPage?.meta?.totalRowCount;
  const filterDBRowCount = firstPage?.meta?.filterRowCount;
  const metadata = lastPage?.meta?.metadata;
  const chartData = lastPage?.meta?.chartData;
  const facets = lastPage?.meta?.facets;
  const totalFetched = flatData?.length;

  const { sort, cursor, direction, uuid, ...filter } = search;

  // TODO: replace completely by facets
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const filterFields = React.useMemo(() => {
    return defaultFilterFields.map((field) => {
      const facet = facets?.[field.value];
      if (facet) {
        // TODO: facets
        if (["status", "method"].includes(field.value)) {
          field.options = facet.rows.map((row) => ({
            value: row.value,
            label: row.value,
          }));
        }
        if (field.value === "latency") {
          field.min = facet.min || field.min;
          field.max = facet.max || field.max;
          field.options = facet.rows.map((row) => ({
            value: row.value,
            label: row.value,
          }));
        }
      }
      return field;
    });
  }, [flatData]);

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
      getRowClassName={(row) => getLevelRowClassName(row.original.level)}
      getRowId={(row) =>
        `${row.region}-${row.timestamp}-${row.url}-${row.latency}`
      }
      filterFields={filterFields}
      isFetching={isFetching}
      isLoading={isLoading}
      getFacetedUniqueValues={getFacetedUniqueValues(facets)}
      getFacetedMinMaxValues={getFacetedMinMaxValues(facets)}
      fetchNextPage={fetchNextPage}
      hasNextPage={hasNextPage}
      refetch={refetch}
      tableId="light"
      commandSlot={
        <DataTableFilterCommand
          schema={filterSchema.definition}
          tableId="light"
        />
      }
      chartSlot={
        <TimelineChart
          data={chartData ?? []}
          className="-mb-2"
          columnId="timestamp"
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
        <LightSheetSlot
          totalRows={totalDBRowCount ?? 0}
          filterRows={filterDBRowCount ?? 0}
          totalRowsFetched={totalFetched}
          metadata={metadata}
        />
      }
    />
  );
}

function LightSheetSlot({
  totalRows,
  filterRows,
  totalRowsFetched,
  metadata,
}: {
  totalRows: number;
  filterRows: number;
  totalRowsFetched: number;
  metadata: unknown;
}) {
  const { table, rowSelection, isLoading, filterFields } = useDataTable<
    ColumnType,
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
      title={selectedRow?.original.url}
      titleClassName="font-mono"
    >
      <MemoizedDataTableSheetContent
        table={table}
        data={selectedRow?.original}
        filterFields={filterFields}
        fields={sheetFields}
        metadata={{
          totalRows,
          filterRows,
          totalRowsFetched,
          ...(metadata as Record<string, unknown>),
        }}
      />
    </DataTableSheetDetails>
  );
}

"use client";

import { DataTableFilterCommand } from "@dtf/registry/components/data-table/data-table-filter-command";
import { DataTableInfinite } from "@dtf/registry/components/data-table/data-table-infinite";
import { useDataTable } from "@dtf/registry/components/data-table/data-table-provider";
import { MemoizedDataTableSheetContent } from "@dtf/registry/components/data-table/data-table-sheet/data-table-sheet-content";
import { DataTableSheetDetails } from "@dtf/registry/components/data-table/data-table-sheet/data-table-sheet-details";
import type { SheetField } from "@dtf/registry/components/data-table/types";
import {
  applyFacets,
  getFacetedMinMaxValues,
  getFacetedUniqueValues,
  getMetaPage,
} from "@dtf/registry/lib/data-table";
import { isActive } from "@dtf/registry/lib/filters";
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
import { filterSchema, type FilterState, type SearchParams } from "./schema";
import { tableSchema, type ColumnSchema } from "./table-schema";

// Everything the table renders is generated from the schema, once.
const columns = generateColumns<ColumnSchema>(tableSchema.definition);
const filterFields = generateFilterFields<ColumnSchema>(tableSchema.definition);
const sheetFields = generateSheetFields<ColumnSchema>(tableSchema.definition);
const defaultColumnVisibility = getDefaultColumnVisibility(
  tableSchema.definition,
);

/** URL state that is not a column filter. */
const STATE_KEYS = new Set(["sort", "uuid", "size", "direction", "cursor"]);

export function Client({ initialState }: { initialState: SearchParams }) {
  const adapter = useNuqsAdapter(filterSchema.definition, {
    id: "example",
    initialState,
  });

  return (
    <DataTableStoreProvider adapter={adapter}>
      <Table />
    </DataTableStoreProvider>
  );
}

function Table() {
  const search = useFilterState<FilterState>();
  const { data, isFetching, isLoading, fetchNextPage, hasNextPage, refetch } =
    useInfiniteQuery(dataOptions(search));

  const flatData = React.useMemo(
    () => data?.pages?.flatMap((page) => page.data ?? []) ?? [],
    [data?.pages],
  );

  // Facets and counts come from the page that carries meta — the first one,
  // since pagination requests skip it.
  const meta = getMetaPage(data)?.meta;
  const facets = meta?.facets;

  const defaultColumnFilters = Object.entries(search)
    .filter(([key, value]) => !STATE_KEYS.has(key) && isActive(value))
    .map(([id, value]) => ({ id, value }));

  const dynamicFilterFields = React.useMemo(
    () => applyFacets(filterFields, facets),
    [facets],
  );

  return (
    <DataTableInfinite
      columns={columns}
      data={flatData}
      totalRows={meta?.totalRowCount}
      filterRows={meta?.filterRowCount}
      totalRowsFetched={flatData.length}
      defaultColumnFilters={defaultColumnFilters}
      defaultColumnSorting={search.sort ? [search.sort] : undefined}
      defaultRowSelection={search.uuid ? { [search.uuid]: true } : undefined}
      defaultColumnVisibility={defaultColumnVisibility}
      filterFields={dynamicFilterFields}
      isFetching={isFetching}
      isLoading={isLoading}
      fetchNextPage={fetchNextPage}
      hasNextPage={hasNextPage}
      refetch={refetch}
      getRowId={(row) => row.uuid}
      getFacetedUniqueValues={getFacetedUniqueValues(facets)}
      getFacetedMinMaxValues={getFacetedMinMaxValues(facets)}
      commandSlot={
        <DataTableFilterCommand
          schema={filterSchema.definition}
          tableId="example"
        />
      }
      sheetSlot={
        <SheetSlot
          sheetFields={sheetFields}
          totalRows={meta?.totalRowCount ?? 0}
          filterRows={meta?.filterRowCount ?? 0}
          totalRowsFetched={flatData.length}
        />
      }
      tableId="example"
    />
  );
}

function SheetSlot({
  sheetFields: fields,
  totalRows,
  filterRows,
  totalRowsFetched,
}: {
  sheetFields: SheetField<ColumnSchema>[];
  totalRows: number;
  filterRows: number;
  totalRowsFetched: number;
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
      title={
        selectedRow
          ? `${selectedRow.original.method} ${selectedRow.original.pathname}`
          : undefined
      }
      titleClassName="font-mono"
    >
      <MemoizedDataTableSheetContent
        table={table}
        data={selectedRow?.original}
        filterFields={filterFields}
        fields={fields}
        metadata={{ totalRows, filterRows, totalRowsFetched }}
      />
    </DataTableSheetDetails>
  );
}

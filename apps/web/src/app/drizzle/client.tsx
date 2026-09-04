"use client";

import { LiveButton } from "@/components/data-table/data-table-infinite/live-button";
import { LiveRow } from "@/components/data-table/data-table-infinite/live-row";
import { RefreshButton } from "@/components/data-table/data-table-infinite/refresh-button";
import { SocialsFooter } from "@/components/data-table/data-table-infinite/socials-footer";
import { TimelineChart } from "@/components/data-table/data-table-infinite/timeline-chart";
import { timingPhasesColumn } from "@/components/data-table/data-table-infinite/timing-phases-column";
import { getLevelRowClassName } from "@/lib/request/level";
import { cn } from "@/lib/utils";
import {
  createActionsColumn,
  DataTableActionsBar,
  DataTableActionsProvider,
} from "@dtf/registry/components/data-table/data-table-actions";
import { DataTableFilterAICommand } from "@dtf/registry/components/data-table/data-table-filter-command-ai";
import { DataTableFloatingBar } from "@dtf/registry/components/data-table/data-table-floating-bar";
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

const baseColumns = [
  ...generateColumns<ColumnSchema>(tableSchema.definition),
  timingPhasesColumn,
];
// Renders from `meta.actions` + each row's `_actions`. Appended only once the
// server advertises actions, and hidden by default even then — users enable it
// from the view options. Both arrays are module constants so the table's
// options stay referentially stable on either side of the switch.
const columnsWithActions = [
  ...baseColumns,
  createActionsColumn<ColumnSchema>({ size: 37 }),
];

const filterFields = generateFilterFields<ColumnSchema>(tableSchema.definition);
const sheetFields = generateSheetFields<ColumnSchema>(tableSchema.definition);
const defaultColumnVisibility = {
  ...getDefaultColumnVisibility(tableSchema.definition),
  // The actions column ships hidden; users opt in via the view options.
  actions: false,
};

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
  const actions = lastPage?.meta?.actions;
  const columns = actions?.length ? columnsWithActions : baseColumns;
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
    <DataTableActionsProvider<ColumnSchema>
      actions={actions}
      getRowId={(row) => row.uuid}
      // The uuid identifies the row on the wire; this names it for a screen
      // reader reading the actions trigger.
      getRowLabel={(row) => `${row.method} ${row.pathname}`}
      queryKeyPrefix="drizzle"
    >
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
        floatingBarSlot={
          <DataTableFloatingBar<ColumnSchema>>
            {({ rows }) => <DataTableActionsBar rows={rows} />}
          </DataTableFloatingBar>
        }
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
    </DataTableActionsProvider>
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
  // With a select column the table is multi-select: a row click writes `uuid`
  // to the store and `rowSelection` is the checkbox set for bulk actions. The
  // detail row therefore comes from `uuid`, exactly as `DataTableSheetDetails`
  // resolves it — reading `rowSelection` here showed a skeleton on every click.
  const uuid = useFilterState((s) => s.uuid) as string | null | undefined;
  const isMultiSelect = !!table.options.enableMultiRowSelection;
  const selectedRowKey = isMultiSelect
    ? (uuid ?? undefined)
    : Object.keys(rowSelection)?.[0];
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

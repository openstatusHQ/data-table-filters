"use client";

import { DataTableFilterAICommand } from "@/components/data-table/data-table-filter-command-ai";
import { DataTableFloatingBar } from "@/components/data-table/data-table-floating-bar";
import { DataTableInfinite } from "@/components/data-table/data-table-infinite";
import { LiveButton } from "@/components/data-table/data-table-infinite/live-button";
import { LiveRow } from "@/components/data-table/data-table-infinite/live-row";
import { RefreshButton } from "@/components/data-table/data-table-infinite/refresh-button";
import { SocialsFooter } from "@/components/data-table/data-table-infinite/socials-footer";
import { TimelineChart } from "@/components/data-table/data-table-infinite/timeline-chart";
import { timingPhasesColumn } from "@/components/data-table/data-table-infinite/timing-phases-column";
import { useDataTable } from "@/components/data-table/data-table-provider";
import { MemoizedDataTableSheetContent } from "@/components/data-table/data-table-sheet/data-table-sheet-content";
import { DataTableSheetDetails } from "@/components/data-table/data-table-sheet/data-table-sheet-details";
import type { SheetField } from "@/components/data-table/types";
import { Button } from "@/components/ui/button";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { useHotKey } from "@/hooks/use-hot-key";
import { useLiveMode } from "@/hooks/use-live-mode";
import {
  getFacetedMinMaxValues,
  getFacetedUniqueValues,
} from "@/lib/data-table/faceted";
import { getLevelRowClassName } from "@/lib/request/level";
import type { AdapterType } from "@/lib/store/adapter/types";
import { useNuqsAdapter } from "@/lib/store/adapters/nuqs";
import { useZustandAdapter } from "@/lib/store/adapters/zustand";
import { useFilterState } from "@/lib/store/hooks/useFilterState";
import { DataTableStoreProvider } from "@/lib/store/provider/DataTableStoreProvider";
import {
  generateColumns,
  generateFilterFields,
  generateSheetFields,
  getDefaultColumnVisibility,
} from "@/lib/table-schema";
import { cn } from "@/lib/utils";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { Row } from "@tanstack/react-table";
import { Check, Copy } from "lucide-react";
import * as React from "react";
import { dataOptions } from "./query-options";
import type { ColumnSchema, FilterState } from "./schema";
import { filterSchema } from "./schema";
import { SearchParamsType } from "./search-params";
import { useFilterStore } from "./store";
import { tableSchema } from "./table-schema";

// Generated from tableSchema — stable references (defined at module level to
// avoid recreating on every render)
const columns = [
  ...generateColumns<ColumnSchema>(tableSchema.definition),
  timingPhasesColumn,
];

const filterFields = generateFilterFields<ColumnSchema>(tableSchema.definition);
const sheetFields = generateSheetFields<ColumnSchema>(tableSchema.definition);
const defaultColumnVisibility = getDefaultColumnVisibility(
  tableSchema.definition,
);

export function Client({
  defaultAdapterType = "nuqs",
  defaultPrefetchEnabled = false,
  initialState,
}: {
  defaultAdapterType?: AdapterType;
  defaultPrefetchEnabled?: boolean;
  initialState?: SearchParamsType;
}) {
  useResetFocus();

  // Key forces remount when adapter changes, ensuring clean state
  return (
    <React.Fragment>
      {defaultAdapterType === "nuqs" ? (
        <NuqsClient
          prefetchEnabled={defaultPrefetchEnabled}
          initialState={initialState}
        />
      ) : (
        <ZustandClient
          prefetchEnabled={defaultPrefetchEnabled}
          initialState={initialState}
        />
      )}
    </React.Fragment>
  );
}

function NuqsClient({
  prefetchEnabled,
  initialState,
}: {
  prefetchEnabled: boolean;
  initialState?: SearchParamsType;
}) {
  const adapter = useNuqsAdapter(filterSchema.definition, {
    id: "infinite",
    initialState,
  });

  return (
    <DataTableStoreProvider adapter={adapter}>
      <ClientInner adapterType="nuqs" prefetchEnabled={prefetchEnabled} />
    </DataTableStoreProvider>
  );
}

function ZustandClient({
  prefetchEnabled,
  initialState,
}: {
  prefetchEnabled: boolean;
  initialState?: SearchParamsType;
}) {
  const adapter = useZustandAdapter(useFilterStore, filterSchema.definition, {
    id: "infinite",
    initialState,
  });

  return (
    <DataTableStoreProvider adapter={adapter}>
      <ClientInner adapterType="zustand" prefetchEnabled={prefetchEnabled} />
    </DataTableStoreProvider>
  );
}

// Inner component that can use BYOS hooks (inside provider context)
function ClientInner({
  adapterType,
  prefetchEnabled,
}: {
  adapterType: AdapterType;
  prefetchEnabled: boolean;
}) {
  // Read full state from adapter for data fetching
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

  // REMINDER: meta data is always the same for all pages as filters do not change(!)
  const lastPage = data?.pages?.[data?.pages.length - 1];
  const totalDBRowCount = lastPage?.meta?.totalRowCount;
  const filterDBRowCount = lastPage?.meta?.filterRowCount;
  const metadata = lastPage?.meta?.metadata;
  const chartData = lastPage?.meta?.chartData;
  const facets = lastPage?.meta?.facets;
  const totalFetched = flatData?.length;

  const { sort, size, uuid, cursor, direction, live, ...filter } = search;

  // REMINDER: this is currently needed for the cmdk search
  // TODO: auto search via API when the user changes the filter instead of hardcoded
  const dynamicFilterFields = React.useMemo(() => {
    return filterFields.map((field) => {
      const facetsField = facets?.[field.value as string];
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
          api="/infinite/api/ai"
          tableId="infinite"
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
          showConfigurationDropdown
          prefetchEnabled={prefetchEnabled}
          adapterType={adapterType}
        />
      }
      sheetSlot={
        <InfiniteSheetSlot
          sheetFields={sheetFields}
          totalRows={totalDBRowCount ?? 0}
          filterRows={filterDBRowCount ?? 0}
          totalRowsFetched={totalFetched}
          metadata={metadata ?? {}}
        />
      }
      floatingBarSlot={
        <DataTableFloatingBar<ColumnSchema>>
          {({ rows }) => <InfiniteFloatingBarSlot rows={rows} />}
        </DataTableFloatingBar>
      }
      tableId="infinite"
    />
  );
}

function InfiniteFloatingBarSlot({ rows }: { rows: Row<ColumnSchema>[] }) {
  const { copy, isCopied } = useCopyToClipboard();
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          const json = JSON.stringify(
            rows.map((r) => r.original),
            (_, v) => (v instanceof Date ? v.toISOString() : v),
            2,
          );
          copy(json);
        }}
      >
        {!isCopied ? <Copy /> : <Check />}
        Copy as JSON
      </Button>
    </>
  );
}

function InfiniteSheetSlot({
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
    // FIXME: some dedicated div[tabindex="0"] do not auto-unblur (e.g. the DataTableFilterResetButton)
    // REMINDER: we cannot just document.activeElement?.blur(); as the next tab will focus the next element in line,
    // which is not what we want. We want to reset entirely.
    document.body.setAttribute("tabindex", "0");
    document.body.focus();
    document.body.removeAttribute("tabindex");
  }, ".");
}

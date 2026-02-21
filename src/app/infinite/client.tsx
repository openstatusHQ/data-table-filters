"use client";

import { useHotKey } from "@/hooks/use-hot-key";
import { getLevelRowClassName } from "@/lib/request/level";
import {
  DataTableStoreProvider,
  useFilterState,
  type AdapterType,
} from "@/lib/store";
import { useNuqsAdapter } from "@/lib/store/adapters/nuqs";
import { useZustandAdapter } from "@/lib/store/adapters/zustand";
import {
  generateColumns,
  generateFilterFields,
  generateSheetFields,
  getDefaultColumnVisibility,
} from "@/lib/table-schema";
import { cn } from "@/lib/utils";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { Table as TTable } from "@tanstack/react-table";
import * as React from "react";
import { timingPhasesColumn } from "./_components/timing-phases-column";
import { LiveRow } from "./_components/live-row";
import { DataTableInfinite } from "./data-table-infinite";
import { dataOptions } from "./query-options";
import type { ColumnSchema, FacetMetadataSchema, FilterState } from "./schema";
import { filterSchema } from "./schema";
import type { LogsMeta } from "./query-options";
import { tableSchema } from "./table-schema";
import { useFilterStore } from "./store";

// Generated from tableSchema — stable references (defined at module level to
// avoid recreating on every render)
const columns = [
  ...generateColumns<ColumnSchema>(tableSchema.definition),
  timingPhasesColumn,
];

const filterFields = generateFilterFields<ColumnSchema>(tableSchema.definition);
const sheetFields = generateSheetFields<ColumnSchema>(tableSchema.definition);
const defaultColumnVisibility = getDefaultColumnVisibility(tableSchema.definition);

export function Client({
  defaultAdapterType = "nuqs",
  defaultPrefetchEnabled = false,
}: {
  defaultAdapterType?: AdapterType;
  defaultPrefetchEnabled?: boolean;
}) {
  useResetFocus();

  // Key forces remount when adapter changes, ensuring clean state
  return (
    <React.Fragment>
      {defaultAdapterType === "nuqs" ? (
        <NuqsClient prefetchEnabled={defaultPrefetchEnabled} />
      ) : (
        <ZustandClient prefetchEnabled={defaultPrefetchEnabled} />
      )}
    </React.Fragment>
  );
}

function NuqsClient({ prefetchEnabled }: { prefetchEnabled: boolean }) {
  const adapter = useNuqsAdapter(filterSchema.definition, { id: "infinite" });

  return (
    <DataTableStoreProvider adapter={adapter}>
      <ClientInner adapterType="nuqs" prefetchEnabled={prefetchEnabled} />
    </DataTableStoreProvider>
  );
}

function ZustandClient({ prefetchEnabled }: { prefetchEnabled: boolean }) {
  const adapter = useZustandAdapter(useFilterStore, filterSchema.definition, {
    id: "infinite",
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

  const { sort, start, size, uuid, cursor, direction, live, ...filter } =
    search;

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
      adapterType={adapterType}
      prefetchEnabled={prefetchEnabled}
      showConfigurationDropdown
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

// TODO: make a BaseObject (incl. date and uuid e.g. for every upcoming branch of infinite table)
// NOTE: Must be called inside DataTableStoreProvider context
export function useLiveMode<TData extends { date: Date }>(data: TData[]) {
  const live = useFilterState<FilterState, FilterState["live"]>((s) => s.live);
  // REMINDER: used to capture the live mode on timestamp
  const liveTimestamp = React.useRef<number | undefined>(
    live ? new Date().getTime() : undefined,
  );

  React.useEffect(() => {
    if (live) liveTimestamp.current = new Date().getTime();
    else liveTimestamp.current = undefined;
  }, [live]);

  const anchorRow = React.useMemo(() => {
    if (!live) return undefined;

    // eslint-disable-next-line react-hooks/refs
    const item = data.find((item) => {
      // return first item that is there if not liveTimestamp
      if (!liveTimestamp.current) return true;
      // return first item that is after the liveTimestamp
      if (item.date.getTime() > liveTimestamp.current) return false;
      return true;
      // return first item if no liveTimestamp
    });

    return item;
  }, [live, data]);

  // eslint-disable-next-line react-hooks/refs
  return { row: anchorRow, timestamp: liveTimestamp.current };
}

export function getFacetedUniqueValues<TData>(
  facets?: Record<string, FacetMetadataSchema>,
) {
  return (_: TTable<TData>, columnId: string): Map<string, number> => {
    return new Map(
      facets?.[columnId]?.rows?.map(({ value, total }) => [value, total]) || [],
    );
  };
}

export function getFacetedMinMaxValues<TData>(
  facets?: Record<string, FacetMetadataSchema>,
) {
  return (_: TTable<TData>, columnId: string): [number, number] | undefined => {
    const min = facets?.[columnId]?.min;
    const max = facets?.[columnId]?.max;
    if (typeof min === "number" && typeof max === "number") return [min, max];
    if (typeof min === "number") return [min, min];
    if (typeof max === "number") return [max, max];
    return undefined;
  };
}

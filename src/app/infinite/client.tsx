"use client";

import * as React from "react";
import { DataTableInfinite } from "./data-table-infinite";
import { columns } from "./columns";
import { filterFields as defaultFilterFields, sheetFields } from "./constants";
import { useQueryState, useQueryStates } from "nuqs";
import { searchParamsParser } from "./search-params";
import { useInfiniteQuery } from "@tanstack/react-query";
import { dataOptions } from "./query-options";
import { useHotKey } from "@/hooks/use-hot-key";
import { getLevelRowClassName } from "@/lib/request/level";
import type { FacetMetadataSchema } from "./schema";
import type { Table as TTable } from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import { LiveRow } from "./_components/live-row";

export function Client() {
  const [search] = useQueryStates(searchParamsParser);
  const {
    data,
    isFetching,
    isLoading,
    fetchNextPage,
    fetchPreviousPage,
    refetch,
  } = useInfiniteQuery(dataOptions(search));
  useResetFocus();

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
  const filterFields = React.useMemo(() => {
    return defaultFilterFields.map((field) => {
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
  }, [facets]);

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
      fetchPreviousPage={fetchPreviousPage}
      refetch={refetch}
      chartData={chartData}
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
        return <LiveRow />;
      }}
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
function useLiveMode<TData extends { date: Date }>(data: TData[]) {
  const [live] = useQueryState("live", searchParamsParser.live);
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

  return { row: anchorRow, timestamp: liveTimestamp.current };
}

function getFacetedUniqueValues<TData>(
  facets?: Record<string, FacetMetadataSchema>,
) {
  return (_: TTable<TData>, columnId: string): Map<string, number> => {
    return new Map(
      facets?.[columnId]?.rows?.map(({ value, total }) => [value, total]) || [],
    );
  };
}

function getFacetedMinMaxValues<TData>(
  facets?: Record<string, FacetMetadataSchema>,
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

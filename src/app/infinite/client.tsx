"use client";

import * as React from "react";
import { DataTableInfinite } from "./data-table-infinite";
import { columns } from "./columns";
import { filterFields as defaultFilterFields } from "./constants";
import { useQueryStates } from "nuqs";
import { searchParamsParser } from "./search-params";
import { useInfiniteQuery } from "@tanstack/react-query";
import { dataOptions } from "./query-options";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SheetDetails } from "./sheet-details";

export function Client() {
  const [search, setSearch] = useQueryStates(searchParamsParser);
  const { data, isFetching, isLoading, fetchNextPage } = useInfiniteQuery(
    dataOptions(search)
  );

  const flatData = React.useMemo(
    () => data?.pages?.flatMap((page) => page.data ?? []) ?? [],
    [data?.pages]
  );

  const lastPage = data?.pages?.[data?.pages.length - 1];
  const totalDBRowCount = lastPage?.meta?.totalRowCount;
  const filterDBRowCount = lastPage?.meta?.filterRowCount;
  const totalFilters = lastPage?.meta?.totalFilters;
  const totalFetched = flatData?.length;

  const { sort, start, size, uuid, ...filter } = search;

  const filterFields = React.useMemo(
    () =>
      defaultFilterFields.map((field) => {
        if (field.value === "latency" || field.value === "status") {
          field.options =
            totalFilters?.[field.value].map((value) => ({
              label: `${value}`,
              value,
            })) ?? field.options;
        }
        return field;
      }),
    [totalFilters]
  );

  const selected = React.useMemo(
    () => flatData.find((row) => row.uuid === uuid),
    [flatData, uuid]
  );

  return (
    <>
      <DataTableInfinite
        columns={columns}
        // REMINDER: we cannot use `flatData` due to memoization?!?!?
        //   MAYBE: this will be resolved if we add queryKey(search) as the search is unique and will trigger a change of data
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
        filterFields={filterFields}
        isFetching={isFetching}
        isLoading={isLoading}
        fetchNextPage={fetchNextPage}
      />
      <Sheet
        open={!!search.uuid && !!selected}
        onOpenChange={() => setSearch({ uuid: null })}
      >
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Log</SheetTitle>
            <SheetDescription>
              Response details for the selected request.
            </SheetDescription>
            <SheetDetails data={selected} />
          </SheetHeader>
        </SheetContent>
      </Sheet>
    </>
  );
}

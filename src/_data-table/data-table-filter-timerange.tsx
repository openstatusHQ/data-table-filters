"use client";

import useUpdateSearchParams from "@/hooks/use-update-search-params";
import type { Table } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";
import type { DataTableTimerangeFilterField } from "./types";
import { isArrayOfDates } from "./utils";
import { DatePickerWithRange } from "./date-picker-with-range";
import type { DateRange } from "react-day-picker";
import { RANGE_DELIMITER } from "./schema";

type DataTableFilterTimerangeProps<TData> =
  DataTableTimerangeFilterField<TData> & {
    table: Table<TData>;
  };

// TBD: add debounce to reduce to number of filters
// TODO: extract onChange

export function DataTableFilterTimerange<TData>({
  table,
  value: _value,
}: DataTableFilterTimerangeProps<TData>) {
  const value = _value as string;
  const updateSearchParams = useUpdateSearchParams();
  const router = useRouter();
  const column = table.getColumn(value);
  const filterValue = column?.getFilterValue();

  const updatePageSearchParams = useCallback(
    (values: Record<string, string | null>) => {
      const newSearchParams = updateSearchParams(values);
      router.replace(`?${newSearchParams}`, { scroll: false });
    },
    [router, updateSearchParams]
  );

  const date: DateRange | undefined = useMemo(
    () =>
      filterValue instanceof Date
        ? { from: filterValue, to: undefined }
        : Array.isArray(filterValue) && isArrayOfDates(filterValue)
        ? { from: filterValue[0], to: filterValue[1] }
        : undefined,
    [filterValue]
  );

  const setDate = (date: DateRange | undefined) => {
    if (!date) return; // TODO: remove from search params if columnFilter is removed
    if (date.from && !date.to) {
      column?.setFilterValue(date.from);
      updatePageSearchParams({ [value]: `${date.from.getTime()}` });
    }
    if (date.to && date.from) {
      column?.setFilterValue([date.from, date.to]);
      updatePageSearchParams({
        [value]: [date.from.getTime(), date.to.getTime()].join(RANGE_DELIMITER),
      });
    }
  };

  return <DatePickerWithRange {...{ date, setDate }} />;
}

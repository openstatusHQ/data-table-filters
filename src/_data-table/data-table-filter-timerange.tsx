"use client";

import type { Table } from "@tanstack/react-table";
import { useMemo } from "react";
import type { DataTableTimerangeFilterField } from "./types";
import { isArrayOfDates } from "./utils";
import { DatePickerWithRange } from "./date-picker-with-range";
import type { DateRange } from "react-day-picker";
import { useQueryState, useQueryStates } from "nuqs";
import { searchParamsParser } from "./search-params";

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
  const value = _value as keyof typeof searchParamsParser;
  const column = table.getColumn(value);
  const filterValue = column?.getFilterValue();
  // MAYBE USE ONLY useQueryState
  const [search, setSearch] = useQueryStates(searchParamsParser);

  const date: DateRange | undefined = useMemo(
    () =>
      filterValue instanceof Date
        ? { from: filterValue, to: undefined }
        : Array.isArray(filterValue) && isArrayOfDates(filterValue)
        ? { from: filterValue?.[0], to: filterValue?.[1] }
        : undefined,
    [filterValue]
  );

  const setDate = (date: DateRange | undefined) => {
    if (!date) return; // TODO: remove from search params if columnFilter is removed
    if (date.from && !date.to) {
      column?.setFilterValue(date.from);
      setSearch({ ...search, [value]: [date.from.getTime()] });
    }
    if (date.to && date.from) {
      column?.setFilterValue([date.from, date.to]);
      setSearch({
        ...search,
        [value]: [date.from.getTime(), date.to.getTime()],
      });
    }
  };

  return <DatePickerWithRange {...{ date, setDate }} />;
}

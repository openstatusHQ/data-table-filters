import { FilterFn } from "@tanstack/react-table";
import { isSameDay } from "date-fns";
import { isArrayOfDates } from "../is-array";

/**
 * `FilterFn` is generic over `TFeatures`/`TData` in v9, and both parameters are
 * invariant (`in out`). A `const` cannot be generic, and the `filterFns` slot on
 * `tableFeatures()` is typed `Record<string, FilterFn<any, any>>` — so `any` is
 * the only pair that fits here, and it is exactly what the registry expects.
 * These predicates only ever touch `row.getValue()`, so nothing is lost.
 */
type AnyFilterFn = FilterFn<any, any>;

export const inDateRange: AnyFilterFn = (row, columnId, value) => {
  const date = new Date(row.getValue(columnId));
  const [start, end] = value as Date[];

  if (isNaN(date.getTime())) return false;

  // if no end date, check if it's the same day
  if (!end) return isSameDay(date, start);

  // Inclusive bounds to match server-side filtering
  return date.getTime() >= start.getTime() && date.getTime() <= end.getTime();
};

inDateRange.autoRemove = (val: unknown) =>
  !Array.isArray(val) || !val.length || !isArrayOfDates(val);

export const arrSome: AnyFilterFn = (row, columnId, filterValue) => {
  if (!Array.isArray(filterValue)) return false;
  return filterValue.some((val) => row.getValue<unknown[]>(columnId) === val);
};

arrSome.autoRemove = (val: unknown) => !Array.isArray(val) || !val?.length;

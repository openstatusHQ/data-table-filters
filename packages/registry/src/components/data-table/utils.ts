// TODO: check if we can move to /data-table-filter-command/utils.ts
import {
  ARRAY_DELIMITER,
  RANGE_DELIMITER,
  SLIDER_DELIMITER,
} from "@dtf/registry/lib/delimiters";
import type { ColumnFiltersState } from "@tanstack/react-table";
import type { CSSProperties } from "react";
import { z } from "zod";
import type { DataTableFilterField } from "./types";

export function deserialize<T extends z.ZodObject>(schema: T) {
  const castToSchema = z.preprocess((val) => {
    if (typeof val !== "string") return val;
    return val
      .trim()
      .split(" ")
      .reduce(
        (prev, curr) => {
          // Split on the FIRST colon only — values legitimately contain colons
          // (urls, timestamps), and `split(":")` would truncate them.
          const separatorIndex = curr.indexOf(":");
          // -1 = no separator, 0 = empty name; both are skipped
          if (separatorIndex < 1) return prev;
          const name = curr.slice(0, separatorIndex);
          const value = curr.slice(separatorIndex + 1);
          if (!value) return prev;
          prev[name] = value;
          return prev;
        },
        {} as Record<string, unknown>,
      );
  }, schema);
  return (value: string) => castToSchema.safeParse(value);
}

export function serializeColumnFilters<TData>(
  columnFilters: ColumnFiltersState,
  filterFields?: DataTableFilterField<TData>[],
) {
  return columnFilters.reduce((prev, curr) => {
    const { type, commandDisabled } = filterFields?.find(
      (field) => curr.id === field.value,
    ) || { commandDisabled: true }; // if column filter is not found, disable the command by default

    if (commandDisabled) return prev;

    if (Array.isArray(curr.value)) {
      if (type === "slider") {
        return `${prev}${curr.id}:${curr.value.join(SLIDER_DELIMITER)} `;
      }
      if (type === "checkbox") {
        return `${prev}${curr.id}:${curr.value.join(ARRAY_DELIMITER)} `;
      }
      if (type === "timerange") {
        return `${prev}${curr.id}:${curr.value.join(RANGE_DELIMITER)} `;
      }
    }

    return `${prev}${curr.id}:${curr.value} `;
  }, "");
}

/**
 * Whether another `fetchNextPage()` would actually return rows.
 *
 * `hasNextPage` alone is not enough for cursor pagination as this table's API
 * implements it: the response reports `nextCursor: null` only once a page comes
 * back *empty*, so after the final row React Query still believes there is a
 * next page. Left to `hasNextPage`, the button keeps offering "Load More" until
 * one wasted click fetches nothing and flips it to "No more data to load".
 *
 * When the server reports how many rows match the active filters, that count is
 * authoritative and lets us stop one page early. Consumers that do not pass
 * `filterRows` keep the plain `hasNextPage` behaviour.
 */
export function canLoadMore({
  hasNextPage,
  filterRows,
  totalRowsFetched,
}: {
  hasNextPage?: boolean;
  filterRows?: number;
  totalRowsFetched?: number;
}): boolean {
  if (!hasNextPage) return false;
  if (filterRows === undefined || totalRowsFetched === undefined) return true;
  return totalRowsFetched < filterRows;
}

/**
 * The sizing bounds TanStack merges into every column def
 * (`getDefaultColumnSizingColumnDef` in table-core, not re-exported).
 */
const TANSTACK_SIZE_DEFAULTS = {
  minSize: 20,
  maxSize: Number.MAX_SAFE_INTEGER,
};

/**
 * Derive a header/cell width style from the column's sizing mode:
 *
 * - resizable → track the measured size var (`clamp` is `"min"` on headers so
 *   a drag can grow past the content, `"max"` on cells so `truncate` kicks in)
 * - locked (`maxSize` on the def) → pin the var as width, min and max
 * - floor only (`minSize` without `maxSize`) → flex, but never below the floor
 * - unsized → flex freely
 *
 * TanStack merges its own defaults (`minSize: 20`, `maxSize: MAX_SAFE_INTEGER`)
 * into every `columnDef`, so "not set" has to be read as "still the default".
 * Reading presence alone locked every column, and a table narrower than its
 * container then spread the surplus over all of them instead of letting the
 * one unsized column absorb it.
 */
export function columnSizeStyle(
  column: {
    getCanResize: () => boolean;
    columnDef: { minSize?: number; maxSize?: number };
  },
  sizeVar: string,
  clamp: "min" | "max",
): CSSProperties | undefined {
  const width = `var(${sizeVar})`;
  if (column.getCanResize()) {
    return clamp === "min"
      ? { width, minWidth: width }
      : { width, maxWidth: width };
  }
  const { minSize, maxSize } = column.columnDef;
  const hasMax =
    maxSize !== undefined && maxSize !== TANSTACK_SIZE_DEFAULTS.maxSize;
  const hasMin =
    minSize !== undefined && minSize !== TANSTACK_SIZE_DEFAULTS.minSize;
  if (hasMax) return { width, minWidth: width, maxWidth: width };
  if (hasMin) return { minWidth: width };
  return undefined;
}

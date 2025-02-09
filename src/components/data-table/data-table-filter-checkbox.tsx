"use client";

import { useState } from "react";
import type { DataTableCheckboxFilterField } from "./types";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";
import { InputWithAddons } from "@/components/custom/input-with-addons";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useDataTable } from "@/providers/data-table";
import { formatCompactNumber } from "@/lib/format";

export function DataTableFilterCheckbox<TData>({
  value: _value,
  options,
  component,
}: DataTableCheckboxFilterField<TData>) {
  const value = _value as string;
  const [inputValue, setInputValue] = useState("");
  const { table, columnFilters, isLoading, getFacetedUniqueValues } =
    useDataTable();
  const column = table.getColumn(value);
  // REMINDER: avoid using column?.getFilterValue()
  const filterValue = columnFilters.find((i) => i.id === value)?.value;
  const facetedValue =
    getFacetedUniqueValues?.(table, value) || column?.getFacetedUniqueValues();

  const Component = component;

  // filter out the options based on the input value
  const filterOptions = options?.filter(
    (option) =>
      inputValue === "" ||
      option.label.toLowerCase().includes(inputValue.toLowerCase())
  );

  // CHECK: it could be filterValue or searchValue
  const filters = filterValue
    ? Array.isArray(filterValue)
      ? filterValue
      : [filterValue]
    : [];

  // REMINDER: if no options are defined, while fetching data, we should show a skeleton
  if (isLoading && !filterOptions?.length)
    return (
      <div className="grid rounded-lg border border-border divide-y">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="flex gap-2 items-center justify-between px-2 py-2.5"
          >
            <Skeleton className="h-4 w-4 rounded-sm" />
            <Skeleton className="h-4 w-full rounded-sm" />
          </div>
        ))}
      </div>
    );

  if (!filterOptions?.length) return null;

  return (
    <div className="grid gap-2">
      {options && options.length > 4 ? (
        <InputWithAddons
          placeholder="Search"
          leading={<Search className="mt-0.5 h-4 w-4" />}
          containerClassName="h-9 rounded-lg"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
        />
      ) : null}
      <div className="rounded-lg border border-border empty:border-none">
        {filterOptions
          // TODO: we shoudn't sort the options here, instead filterOptions should be sorted by default
          // .sort((a, b) => a.label.localeCompare(b.label))
          .map((option, index) => {
            const checked = filters.includes(option.value);

            return (
              <div
                key={String(option.value)}
                className={cn(
                  "group relative flex items-center space-x-2 px-2 py-2.5 hover:bg-accent/50",
                  index !== filterOptions.length - 1 ? "border-b" : undefined
                )}
              >
                <Checkbox
                  id={`${value}-${option.value}`}
                  checked={checked}
                  onCheckedChange={(checked) => {
                    const newValue = checked
                      ? [...(filters || []), option.value]
                      : filters?.filter((value) => option.value !== value);
                    column?.setFilterValue(
                      newValue?.length ? newValue : undefined
                    );
                  }}
                />
                <Label
                  htmlFor={`${value}-${option.value}`}
                  className="flex w-full items-center justify-center gap-1 truncate text-foreground/70 group-hover:text-accent-foreground"
                >
                  {Component ? (
                    <Component {...option} />
                  ) : (
                    <span className="truncate font-normal">{option.label}</span>
                  )}
                  <span className="ml-auto flex items-center justify-center font-mono text-xs">
                    {isLoading ? (
                      <Skeleton className="h-4 w-4" />
                    ) : facetedValue?.has(option.value) ? (
                      formatCompactNumber(facetedValue.get(option.value) || 0)
                    ) : null}
                  </span>
                  <button
                    type="button"
                    onClick={() => column?.setFilterValue([option.value])}
                    className={cn(
                      "absolute inset-y-0 right-0 hidden font-normal text-muted-foreground backdrop-blur-sm hover:text-foreground group-hover:block",
                      "rounded-md ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    )}
                  >
                    <span className="px-2">only</span>
                  </button>
                </Label>
              </div>
            );
          })}
      </div>
    </div>
  );
}

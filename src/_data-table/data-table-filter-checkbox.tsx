"use client";

import useUpdateSearchParams from "@/hooks/use-update-search-params";
import type { Table } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { DataTableCheckboxFilterField } from "./types";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";
import { InputWithAddons } from "@/components/custom/input-with-addons";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ARRAY_DELIMITER } from "./schema";

type DataTableFilterCheckboxProps<TData> =
  DataTableCheckboxFilterField<TData> & {
    table: Table<TData>;
  };

export function DataTableFilterCheckobox<TData>({
  table,
  value: _value,
  options,
  component,
}: DataTableFilterCheckboxProps<TData>) {
  const value = _value as string;
  const [inputValue, setInputValue] = useState("");
  const updateSearchParams = useUpdateSearchParams();
  const router = useRouter();
  const column = table.getColumn(value);
  const facetedValue = column?.getFacetedUniqueValues();
  const filterValue = column?.getFilterValue();

  if (!options?.length) return null;

  const updatePageSearchParams = (values: Record<string, string | null>) => {
    const newSearchParams = updateSearchParams(values);
    router.replace(`?${newSearchParams}`, { scroll: false });
  };

  const filterOptions = options.filter(
    (option) =>
      inputValue === "" ||
      option.label.toLowerCase().includes(inputValue.toLowerCase())
  );

  // TODO: check if we could useMemo
  const filters = filterValue
    ? Array.isArray(filterValue)
      ? filterValue
      : [filterValue]
    : [];

  const Component = component;

  return (
    <div className="grid gap-2">
      {options.length > 4 ? (
        <InputWithAddons
          placeholder="Search"
          leading={<Search className="mt-0.5 h-4 w-4" />}
          containerClassName="h-9 rounded-lg"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
        />
      ) : null}
      <div className="rounded-lg border border-border empty:border-none">
        {filterOptions.map((option, index) => {
          const checked = filters.includes(option.value);

          return (
            <div
              key={String(option.value)}
              className={cn(
                "group relative flex items-center space-x-2 px-2 py-2.5 hover:bg-accent",
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
                  updatePageSearchParams({
                    [value]: newValue?.length
                      ? newValue.join(ARRAY_DELIMITER)
                      : null,
                  });
                }}
              />
              <Label
                htmlFor={`${value}-${option.value}`}
                className="flex w-full items-center justify-center gap-1 truncate text-muted-foreground group-hover:text-accent-foreground"
              >
                {Component ? (
                  <Component {...option} />
                ) : (
                  <span className="truncate font-normal">{option.label}</span>
                )}
                <span className="ml-auto flex h-4 w-4 items-center justify-center font-mono text-xs">
                  {facetedValue?.get(option.value)}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    column?.setFilterValue(option.value);
                    updatePageSearchParams({
                      [value]: `${option.value}`,
                    });
                  }}
                  className="absolute inset-y-0 right-0 hidden font-normal text-muted-foreground backdrop-blur-sm hover:text-foreground group-hover:block"
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

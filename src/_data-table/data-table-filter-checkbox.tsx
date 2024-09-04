"use client";

import type { Table } from "@tanstack/react-table";
import { useState } from "react";
import type { DataTableCheckboxFilterField } from "./types";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";
import { InputWithAddons } from "@/components/custom/input-with-addons";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useQueryStates } from "nuqs";
import { searchParamsParser } from "./search-params";

type DataTableFilterCheckboxProps<TData> =
  DataTableCheckboxFilterField<TData> & {
    table: Table<TData>;
  };

export function DataTableFilterCheckbox<TData>({
  table,
  value: _value,
  options,
  component,
}: DataTableFilterCheckboxProps<TData>) {
  const value = _value as keyof typeof searchParamsParser;
  const [inputValue, setInputValue] = useState("");
  const column = table.getColumn(value);
  const facetedValue = column?.getFacetedUniqueValues();
  const filterValue = column?.getFilterValue();
  const [search, setSearch] = useQueryStates(searchParamsParser);

  if (!options?.length) return null;

  const Component = component;

  // filter out the options based on the input value
  const filterOptions = options.filter(
    (option) =>
      inputValue === "" ||
      option.label.toLowerCase().includes(inputValue.toLowerCase())
  );

  // const searchValue = search[value]; // can be anything currently

  // CHECK: it could be filterValue or searchValue
  const filters = filterValue
    ? Array.isArray(filterValue)
      ? filterValue
      : [filterValue]
    : [];

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
                  setSearch({ ...search, [value]: newValue });
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
                    setSearch({ ...search, [value]: option.value });
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

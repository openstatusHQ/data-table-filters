"use client";

import type { ColumnDef, Table } from "@tanstack/react-table";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type React from "react";
import type { DataTableFilterField } from "./types";
import { DataTableFilterResetButton } from "./data-table-filter-reset-button";
import { DataTableFilterCheckobox } from "./data-table-filter-checkbox";
import useUpdateSearchParams from "@/hooks/use-update-search-params";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DataTableFilterSlider } from "./data-table-filter-slider";
import { DataTableFilterInput } from "./data-table-filter-input";
import { DataTableFilterTimerange } from "./data-table-filter-timerange";
import { X } from "lucide-react";

// TODO: only pass the columns to generate the filters!
// https://tanstack.com/table/v8/docs/framework/react/examples/filters
interface DataTableFilterControlsProps<TData, TValue> {
  table: Table<TData>;
  columns: ColumnDef<TData, TValue>[];
  filterFields?: DataTableFilterField<TData>[];
}

export function DataTableFilterControls<TData, TValue>({
  table,
  columns,
  filterFields,
}: DataTableFilterControlsProps<TData, TValue>) {
  const filters = table.getState().columnFilters;
  const updateSearchParams = useUpdateSearchParams();
  const router = useRouter();

  const updatePageSearchParams = (values: Record<string, string | null>) => {
    const newSearchParams = updateSearchParams(values);
    router.replace(`?${newSearchParams}`, { scroll: false });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex h-[46px] items-center justify-between gap-3">
        <p className="font-medium text-foreground">Filters</p>
        <div>
          {filters.length ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                table.resetColumnFilters();
                const resetValues = filters.reduce<Record<string, null>>(
                  (prev, curr) => {
                    prev[curr.id] = null;
                    return prev;
                  },
                  {}
                );
                updatePageSearchParams(resetValues);
              }}
            >
              <X className="mr-2 h-4 w-4" />
              Reset
            </Button>
          ) : null}
        </div>
      </div>
      <Accordion
        type="multiple"
        // REMINDER: open all filters by default
        defaultValue={filterFields
          ?.filter(({ defaultOpen }) => defaultOpen)
          ?.map(({ value }) => value as string)}
      >
        {filterFields?.map((field) => {
          return (
            <AccordionItem
              key={field.value as string}
              value={field.value as string}
              className="border-none"
            >
              <AccordionTrigger className="p-2 hover:no-underline">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground">
                    {field.label}
                  </p>
                  <DataTableFilterResetButton table={table} {...field} />
                </div>
              </AccordionTrigger>
              <AccordionContent className="-m-4 p-4">
                {(() => {
                  switch (field.type) {
                    case "checkbox": {
                      return (
                        <DataTableFilterCheckobox table={table} {...field} />
                      );
                    }
                    case "slider": {
                      return <DataTableFilterSlider table={table} {...field} />;
                    }
                    case "input": {
                      return <DataTableFilterInput table={table} {...field} />;
                    }
                    case "timerange": {
                      return (
                        <DataTableFilterTimerange table={table} {...field} />
                      );
                    }
                  }
                })()}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}

"use client";

import { useDataTable } from "@/components/data-table/data-table-provider";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { DataTableFilterCheckbox } from "./data-table-filter-checkbox";
import { DataTableFilterInput } from "./data-table-filter-input";
import { DataTableFilterResetButton } from "./data-table-filter-reset-button";
import { DataTableFilterSlider } from "./data-table-filter-slider";
import { DataTableFilterTimerange } from "./data-table-filter-timerange";

// FIXME: use @container (especially for the slider element) to restructure elements

// TODO: only pass the columns to generate the filters!
// https://tanstack.com/table/v8/docs/framework/react/examples/filters

// Pluggable filter registry — extend by adding entries
export const FILTER_COMPONENTS: Record<string, React.ComponentType<any>> = {
  checkbox: DataTableFilterCheckbox,
  input: DataTableFilterInput,
  slider: DataTableFilterSlider,
  timerange: DataTableFilterTimerange,
};

export function DataTableFilterControls() {
  const { filterFields } = useDataTable();
  return (
    <Accordion
      type="multiple"
      defaultValue={filterFields
        ?.filter(({ defaultOpen }) => defaultOpen)
        ?.map(({ value }) => value as string)}
    >
      {filterFields?.map((field) => {
        const value = field.value as string;
        const FilterComponent = FILTER_COMPONENTS[field.type];
        if (!FilterComponent) return null;
        return (
          <AccordionItem key={value} value={value} className="border-none">
            <AccordionTrigger className="data-[state=closed]:text-muted-foreground data-[state=open]:text-foreground focus-within:data-[state=closed]:text-foreground hover:data-[state=closed]:text-foreground w-full items-center px-2 py-0 hover:no-underline">
              <div className="flex w-full items-center justify-between gap-2 truncate py-2">
                <div className="flex items-center gap-2 truncate">
                  <p className="text-sm font-medium">{field.label}</p>
                  {value !== field.label.toLowerCase() &&
                  !field.commandDisabled ? (
                    <p className="text-muted-foreground mt-px truncate font-mono text-[10px]">
                      {value}
                    </p>
                  ) : null}
                </div>
                <DataTableFilterResetButton {...field} />
              </div>
            </AccordionTrigger>
            <AccordionContent>
              {/* REMINDER: avoid the focus state to be cut due to overflow-hidden */}
              {/* REMINDER: need to move within here because of accordion height animation */}
              <div className="p-1">
                <FilterComponent {...field} />
              </div>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}

"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/custom/accordion";
import type React from "react";
import { DataTableFilterResetButton } from "./data-table-filter-reset-button";
import { DataTableFilterCheckbox } from "./data-table-filter-checkbox";
import { DataTableFilterSlider } from "./data-table-filter-slider";
import { DataTableFilterInput } from "./data-table-filter-input";
import { DataTableFilterTimerange } from "./data-table-filter-timerange";
import { useDataTable } from "@/providers/data-table";

// FIXME: use @container (especially for the slider element) to restructure elements

// TODO: only pass the columns to generate the filters!
// https://tanstack.com/table/v8/docs/framework/react/examples/filters

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
        return (
          <AccordionItem key={value} value={value} className="border-none">
            <AccordionTrigger className="px-2 py-0 hover:no-underline w-full data-[state=closed]:text-muted-foreground data-[state=open]:text-foreground hover:data-[state=closed]:text-foreground focus-within:data-[state=closed]:text-foreground">
              <div className="w-full flex items-center justify-between gap-2 truncate pr-2 py-2">
                <div className="flex gap-2 items-center truncate">
                  <p className="text-sm font-medium">{field.label}</p>
                  {value !== field.label.toLowerCase() &&
                  !field.commandDisabled ? (
                    <p className="text-muted-foreground text-[10px] font-mono mt-px truncate">
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
                {(() => {
                  switch (field.type) {
                    case "checkbox": {
                      return <DataTableFilterCheckbox {...field} />;
                    }
                    case "slider": {
                      return <DataTableFilterSlider {...field} />;
                    }
                    case "input": {
                      return <DataTableFilterInput {...field} />;
                    }
                    case "timerange": {
                      return <DataTableFilterTimerange {...field} />;
                    }
                  }
                })()}
              </div>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}

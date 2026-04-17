"use client";

import { useDataTable } from "@dtf/registry/components/data-table/data-table-provider";
import { Button } from "@dtf/registry/components/ui/button";
import { Kbd } from "@dtf/registry/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@dtf/registry/components/ui/tooltip";
import { useHotKey } from "@dtf/registry/hooks/use-hot-key";
import { X } from "lucide-react";

export function DataTableResetButton() {
  const { table } = useDataTable();
  useHotKey(table.resetColumnFilters, "Escape");

  return (
    <TooltipProvider>
      <Tooltip delayDuration={100}>
        <TooltipTrigger asChild>
          <Button variant="ghost" onClick={() => table.resetColumnFilters()}>
            <X className="mr-2 h-4 w-4" />
            Reset
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p className="text-nowrap">
            Reset filters with{" "}
            <Kbd className="text-muted-foreground group-hover:text-accent-foreground ml-1">
              <span className="mr-1">⌘</span>
              <span>Esc</span>
            </Kbd>
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

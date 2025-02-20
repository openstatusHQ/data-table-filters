"use client";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  FilterIcon,
  LoaderCircle,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { DataTableViewOptions } from "./data-table-view-options";
import { Kbd } from "@/components/custom/kbd";
import { DataTableResetButton } from "./data-table-reset-button";
import { useHotKey } from "@/hooks/use-hot-key";
import { useDataTable } from "@/providers/data-table";
import { useControls } from "@/providers/controls";
import { useMemo } from "react";
import { formatCompactNumber } from "@/lib/format";
import { DataTableFilterControlsDrawer } from "./data-table-filter-controls-drawer";

export function DataTableToolbar() {
  const { table, isLoading, columnFilters } = useDataTable();
  const { open, setOpen } = useControls();
  useHotKey(() => setOpen((prev) => !prev), "b");
  const filters = table.getState().columnFilters;

  const rows = useMemo(
    () => ({
      total: table.getCoreRowModel().rows.length,
      filtered: table.getFilteredRowModel().rows.length,
    }),
    [isLoading, columnFilters]
  );

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setOpen((prev) => !prev)}
                className="hidden gap-2 sm:flex"
              >
                {open ? (
                  <>
                    <PanelLeftClose className="hidden sm:block h-4 w-4" />
                    <FilterIcon className="block sm:hidden h-4 w-4" />
                    <span className="hidden sm:block">Hide Controls</span>
                  </>
                ) : (
                  <>
                    <PanelLeftOpen className="hidden sm:block h-4 w-4" />
                    <FilterIcon className="block sm:hidden h-4 w-4" />
                    <span className="hidden sm:block">Show Controls</span>
                  </>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>
                Toggle controls with{" "}
                <Kbd className="ml-1 text-muted-foreground group-hover:text-accent-foreground">
                  <span className="mr-1">⌘</span>
                  <span>B</span>
                </Kbd>
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <div className="block sm:hidden">
          <DataTableFilterControlsDrawer />
        </div>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium font-mono">
            {formatCompactNumber(rows.filtered)}
          </span>{" "}
          of <span className="font-medium font-mono">{rows.total}</span> row(s)
          filtered
        </p>
        {isLoading ? (
          <LoaderCircle className="ml-2 h-4 w-4 animate-spin text-muted-foreground" />
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        {filters.length ? <DataTableResetButton /> : null}
        <DataTableViewOptions />
      </div>
    </div>
  );
}

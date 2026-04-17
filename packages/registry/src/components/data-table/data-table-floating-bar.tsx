"use client";

import { Button } from "@dtf/registry/components/ui/button";
import { Kbd } from "@dtf/registry/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@dtf/registry/components/ui/tooltip";
import { useHotKey } from "@dtf/registry/hooks/use-hot-key";
import type { Row, Table as TTable } from "@tanstack/react-table";
import { X } from "lucide-react";
import * as React from "react";
import { useDataTable } from "./data-table-provider";

interface DataTableFloatingBarProps<TData> {
  children: (props: {
    rows: Row<TData>[];
    table: TTable<TData>;
  }) => React.ReactNode;
}

export function DataTableFloatingBar<TData>({
  children,
}: DataTableFloatingBarProps<TData>) {
  const { table, rowSelection } = useDataTable<TData, unknown>();
  const selectedRowCount = Object.keys(rowSelection).length;

  const selectedRows = React.useMemo(() => {
    return table.getFilteredSelectedRowModel().rows;
    // rowSelection is not used directly but serves as an invalidation trigger
  }, [table, rowSelection]);

  useHotKey(() => table.resetRowSelection(), "x", { shift: true });

  if (selectedRowCount === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-4 z-50 mx-auto w-fit">
      <div className="bg-background border-border flex items-center gap-2 rounded-lg border px-4 py-2.5 shadow-lg">
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground text-sm whitespace-nowrap">
            {selectedRowCount} selected
          </span>
          <TooltipProvider>
            <Tooltip delayDuration={100}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => table.resetRowSelection()}
                  className="text-muted-foreground hover:text-foreground rounded-sm p-0.5 transition-colors"
                  aria-label="Deselect all"
                >
                  <X className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>
                  Deselect all <Kbd>⌘ ⇧ X</Kbd>
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="bg-border mr-1 h-5 w-px" />
        <div className="flex items-center gap-2">
          {children({ rows: selectedRows, table })}
        </div>
      </div>
    </div>
  );
}

"use client";

import { ChevronDown, ChevronUp, X } from "lucide-react";
import * as React from "react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/custom/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Kbd } from "@/components/custom/kbd";
import { cn } from "@/lib/utils";
import { useDataTable } from "@/providers/data-table";
import { Skeleton } from "@/components/ui/skeleton";

export interface DataTableSheetDetailsProps<TData> {
  title?: string;
  titleClassName?: string;
  children?: React.ReactNode;
}

export function DataTableSheetDetails<TData>({
  title,
  titleClassName,
  children,
}: DataTableSheetDetailsProps<TData>) {
  const props = useDataTable();
  const { table, rowSelection, isLoading } = props;

  const selectedRowKey = Object.keys(rowSelection)?.[0];

  const selectedRow = React.useMemo(() => {
    if (isLoading) return;
    return table
      .getCoreRowModel()
      .flatRows.find((row) => row.id === selectedRowKey);
  }, [selectedRowKey, isLoading]);

  const index = table
    .getCoreRowModel()
    .flatRows.findIndex((row) => row.id === selectedRow?.id);

  const nextId = React.useMemo(
    () => table.getCoreRowModel().flatRows[index + 1]?.id,
    [index, isLoading]
  );

  const prevId = React.useMemo(
    () => table.getCoreRowModel().flatRows[index - 1]?.id,
    [index, isLoading]
  );

  const onPrev = React.useCallback(() => {
    if (prevId) table.setRowSelection({ [prevId]: true });
  }, [prevId, isLoading]);

  const onNext = React.useCallback(() => {
    if (nextId) table.setRowSelection({ [nextId]: true });
  }, [nextId, isLoading]);

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (!selectedRowKey) return;

      // REMINDER: prevent dropdown navigation inside of sheet to change row selection
      const activeElement = document.activeElement;
      const isMenuActive = activeElement?.closest('[role="menu"]');

      if (isMenuActive) return;

      if (e.key === "ArrowUp") {
        e.preventDefault();
        onPrev();
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        onNext();
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [selectedRowKey, onNext, onPrev]);

  return (
    <Sheet
      open={!!selectedRowKey}
      onOpenChange={() => {
        // REMINDER: focus back to the row that was selected
        // We need to manually focus back due to missing Trigger component
        const el = selectedRowKey
          ? document.getElementById(selectedRowKey)
          : null;
        table.resetRowSelection();

        // REMINDER: when navigating between tabs in the sheet and exit the sheet, the tab gets lost
        // We need a minimal delay to allow the sheet to close before focusing back to the row
        setTimeout(() => el?.focus(), 0);
      }}
    >
      <SheetContent
        // onCloseAutoFocus={(e) => e.preventDefault()}
        className="sm:max-w-md overflow-y-auto p-0"
        hideClose
      >
        <SheetHeader className="sticky top-0 border-b bg-background p-4 z-10">
          <div className="flex items-center justify-between gap-2">
            <SheetTitle className={cn(titleClassName, "text-left truncate")}>
              {isLoading ? <Skeleton className="h-7 w-36" /> : title}
            </SheetTitle>
            <div className="flex items-center gap-1 h-7">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      disabled={!prevId || isLoading}
                      onClick={onPrev}
                    >
                      <ChevronUp className="h-5 w-5" />
                      <span className="sr-only">Previous</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      Navigate <Kbd variant="outline">↑</Kbd>
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      disabled={!nextId || isLoading}
                      onClick={onNext}
                    >
                      <ChevronDown className="h-5 w-5" />
                      <span className="sr-only">Next</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      Navigate <Kbd variant="outline">↓</Kbd>
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Separator orientation="vertical" className="mx-1" />
              <SheetClose autoFocus={true} asChild>
                <Button size="icon" variant="ghost" className="h-7 w-7">
                  <X className="h-5 w-5" />
                  <span className="sr-only">Close</span>
                </Button>
              </SheetClose>
            </div>
          </div>
        </SheetHeader>
        <SheetDescription className="sr-only">
          Selected row details
        </SheetDescription>
        <div className="p-4">{children}</div>
      </SheetContent>
    </Sheet>
  );
}

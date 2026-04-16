"use client";

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/custom/sheet";
import { useDataTable } from "@/components/data-table/data-table-provider";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useFilterActions } from "@/lib/store/hooks/useFilterActions";
import { useFilterState } from "@/lib/store/hooks/useFilterState";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import * as React from "react";

export interface DataTableSheetDetailsProps {
  title?: React.ReactNode;
  titleClassName?: string;
  children?: React.ReactNode;
}

export function DataTableSheetDetails({
  title,
  titleClassName,
  children,
}: DataTableSheetDetailsProps) {
  const { table, rowSelection, isLoading } = useDataTable();
  const { setFilters } = useFilterActions();

  const isMultiSelect = !!table.options.enableMultiRowSelection;

  // Read the detail row ID from BYOS uuid when multi-select is enabled,
  // otherwise fall back to rowSelection (existing single-select behavior)
  const uuid = useFilterState((s) => s.uuid) as string | null | undefined;
  const selectedRowKey = isMultiSelect
    ? (uuid ?? undefined)
    : Object.keys(rowSelection)?.[0];

  const selectedRow = React.useMemo(() => {
    if (isLoading && !selectedRowKey) return;
    return table
      .getRowModel()
      .flatRows.find((row) => row.id === selectedRowKey);
  }, [selectedRowKey, isLoading, table]);

  const index = table
    .getRowModel()
    .flatRows.findIndex((row) => row.id === selectedRow?.id);

  const nextId = React.useMemo(
    () => table.getRowModel().flatRows[index + 1]?.id,
    [index, isLoading, table],
  );

  const prevId = React.useMemo(
    () => table.getRowModel().flatRows[index - 1]?.id,
    [index, isLoading, table],
  );

  const onPrev = React.useCallback(() => {
    if (!prevId) return;
    if (isMultiSelect) {
      setFilters({ uuid: prevId });
    } else {
      table.setRowSelection({ [prevId]: true });
    }
  }, [prevId, isLoading, table, isMultiSelect, setFilters]);

  const onNext = React.useCallback(() => {
    if (!nextId) return;
    if (isMultiSelect) {
      setFilters({ uuid: nextId });
    } else {
      table.setRowSelection({ [nextId]: true });
    }
  }, [nextId, isLoading, table, isMultiSelect, setFilters]);

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

        if (isMultiSelect) {
          setFilters({ uuid: null });
        } else {
          table.resetRowSelection();
        }

        // REMINDER: when navigating between tabs in the sheet and exit the sheet, the tab gets lost
        // We need a minimal delay to allow the sheet to close before focusing back to the row
        setTimeout(() => el?.focus(), 0);
      }}
    >
      <SheetContent
        // onCloseAutoFocus={(e) => e.preventDefault()}
        className="overflow-y-auto p-0 sm:max-w-md"
        hideClose
      >
        <SheetHeader className="bg-background sticky top-0 z-10 border-b p-4">
          <div className="flex items-center justify-between gap-2">
            <SheetTitle className={cn(titleClassName, "truncate text-left")}>
              {isLoading && !selectedRowKey ? (
                <Skeleton className="h-7 w-36" />
              ) : (
                title
              )}
            </SheetTitle>
            <div className="flex h-7 items-center gap-1">
              <TooltipProvider>
                <Tooltip delayDuration={100}>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      disabled={!prevId}
                      onClick={onPrev}
                    >
                      <ChevronUp className="h-5 w-5" />
                      <span className="sr-only">Previous</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      Navigate <Kbd>↑</Kbd>
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip delayDuration={100}>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      disabled={!nextId}
                      onClick={onNext}
                    >
                      <ChevronDown className="h-5 w-5" />
                      <span className="sr-only">Next</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      Navigate <Kbd>↓</Kbd>
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

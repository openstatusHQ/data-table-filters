import { Button } from "@dtf/registry/components/ui/button";
import type { DataTableFeatures } from "@dtf/registry/lib/table/features";
import { cn } from "@dtf/registry/lib/utils";
import type { Column, RowData } from "@tanstack/react-table";
import { ChevronDown, ChevronUp } from "lucide-react";
import type React from "react";

interface DataTableColumnHeaderProps<TData extends RowData, TValue>
  extends React.ComponentProps<typeof Button> {
  column: Column<DataTableFeatures, TData, TValue>;
  title: string;
}

export function DataTableColumnHeader<TData extends RowData, TValue>({
  column,
  title,
  className,
  ...props
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return <div className={cn(className)}>{title}</div>;
  }

  return (
    <Button
      variant="ghost"
      onClick={() => {
        column.toggleSorting(undefined);
      }}
      className={cn(
        "flex h-7 w-full items-center justify-between gap-2 px-0 py-0 hover:bg-transparent",
        className,
      )}
      {...props}
    >
      <span>{title}</span>
      <span className="flex flex-col">
        <ChevronUp
          className={cn(
            "-mb-0.5 size-3",
            column.getIsSorted() === "asc"
              ? "text-accent-foreground"
              : "text-muted-foreground",
          )}
        />
        <ChevronDown
          className={cn(
            "-mt-0.5 size-3",
            column.getIsSorted() === "desc"
              ? "text-accent-foreground"
              : "text-muted-foreground",
          )}
        />
      </span>
    </Button>
  );
}

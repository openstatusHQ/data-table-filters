"use client";

import { Button } from "@dtf/registry/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@dtf/registry/components/ui/dropdown-menu";
import type { DataTableFeatures } from "@dtf/registry/lib/table/features";
import type { ColumnDef, RowData } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import { useDataTableActions } from "./provider";
import { rowScopedActions } from "./utils";

/** The cell: a menu of the row-scoped actions this row is stamped with. */
export function DataTableActionsCell<TData>({
  row,
}: {
  row: { original: TData };
}) {
  const { actions, getRowId, getRowActions, getRowLabel, trigger } =
    useDataTableActions<TData>();
  const available = rowScopedActions(actions, getRowActions(row.original));
  if (available.length === 0) return null;
  const id = getRowId(row.original);
  // Never the row id: it is the internal key the wire uses, which for a
  // composite or opaque key reads as noise. Hosts name the row themselves.
  const label = getRowLabel?.(row.original);

  return (
    <div
      className="flex items-center justify-center"
      // The row itself opens the sheet on click and on Enter. Both bubble up
      // from the trigger — and, through React's tree, from the portalled menu
      // items — so both stop here. Only the keys that open the row are
      // stopped; everything else keeps bubbling to the row, the table, and
      // any app-level shortcut listening above them.
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.stopPropagation();
        }
      }}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            className="size-5"
            aria-label={label ? `Actions for ${label}` : "Row actions"}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {available.map((action) => (
            <DropdownMenuItem
              key={action.id}
              variant={
                action.variant === "destructive" ? "destructive" : "default"
              }
              onSelect={() =>
                trigger(action, { scope: "ids", ids: [id] }, { count: 1 })
              }
            >
              {action.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/**
 * A column that renders `DataTableActionsCell`. Append it to the generated
 * columns; it needs a `DataTableActionsProvider` above the table. The column
 * is hideable — pair it with a `columnVisibility` default of `{ [id]: false }`
 * to keep it hidden until enabled from the view options.
 */
export function createActionsColumn<TData extends RowData>(
  options: { id?: string; size?: number } = {},
): ColumnDef<DataTableFeatures, TData> {
  const { id = "actions", size = 40 } = options;
  return {
    id,
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => <DataTableActionsCell row={row} />,
    enableSorting: false,
    enableHiding: true,
    enableResizing: false,
    size,
    minSize: size,
    maxSize: size,
    meta: { label: "Actions", kind: "actions" },
  };
}

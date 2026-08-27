"use client";

// REMINDER: kept through the v9 upgrade. v9 narrows the React Compiler hazard
// but does not remove it: a nested component that hides a state read behind a
// row/cell/column method (`row.getIsSelected()`) is still invisible to the
// compiler. The v9 fix is `Subscribe` around those reads, not a bare opt-in, so
// dropping this is a follow-up with runtime verification — not part of the
// mechanical migration. https://tanstack.com/table/latest/docs/framework/react/guide/react-compiler
"use no memo";

import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@dtf/registry/components/custom/table";
import { DataTableFilterCommand } from "@dtf/registry/components/data-table/data-table-filter-command";
import { DataTableFilterControls } from "@dtf/registry/components/data-table/data-table-filter-controls";
import { DataTableProvider } from "@dtf/registry/components/data-table/data-table-provider";
import { DataTableToolbar } from "@dtf/registry/components/data-table/data-table-toolbar";
import type { DataTableFilterField } from "@dtf/registry/components/data-table/types";
import { useLocalStorage } from "@dtf/registry/hooks/use-local-storage";
import { getColumnVisibilityKey } from "@dtf/registry/lib/constants/local-storage";
import {
  dataTableFeatures,
  type DataTableFeatures,
} from "@dtf/registry/lib/table/features";
import type {
  ColumnDef,
  ColumnFiltersState,
  ColumnVisibilityState,
  PaginationState,
  RowData,
  SortingState,
} from "@tanstack/react-table";
import { flexRender, useTable } from "@tanstack/react-table";
import * as React from "react";
import { filterSchema } from "./schema";

export interface DataTableProps<TData extends RowData> {
  columns: ColumnDef<DataTableFeatures, TData>[];
  data: TData[];
  defaultColumnFilters?: ColumnFiltersState;
  // TODO: add sortingColumnFilters
  filterFields?: DataTableFilterField<TData>[];
  tableId?: string;
}

export function DataTable<TData extends RowData>({
  columns,
  data,
  defaultColumnFilters = [],
  filterFields = [],
  tableId = "default",
}: DataTableProps<TData>) {
  const [columnFilters, setColumnFilters] =
    React.useState<ColumnFiltersState>(defaultColumnFilters);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [columnVisibility, setColumnVisibility] =
    useLocalStorage<ColumnVisibilityState>(getColumnVisibilityKey(tableId), {});

  // Reset pagination when filters change to avoid showing empty pages
  React.useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [columnFilters]);

  const table = useTable({
    // Row models and the array-flattening `facetedUniqueValues` factory are
    // registered once on the shared feature set — see `lib/table/features.ts`.
    // v8 needed a bespoke flattening wrapper here; v9 puts it in a slot.
    features: dataTableFeatures,
    data,
    columns,
    state: { columnFilters, sorting, columnVisibility, pagination },
    onColumnVisibilityChange: setColumnVisibility,
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    // Enable global filtering support
    enableFilters: true,
    enableColumnFilters: true,
  });

  return (
    <DataTableProvider
      table={table}
      columns={columns}
      filterFields={filterFields}
      columnFilters={columnFilters}
      sorting={sorting}
      pagination={pagination}
    >
      <div className="flex h-full w-full flex-col gap-3 sm:flex-row">
        <div
          className={cn(
            "hidden w-full p-1 sm:block sm:max-w-52 sm:min-w-52 sm:self-start md:max-w-64 md:min-w-64",
            "group-data-[expanded=false]/controls:hidden",
          )}
        >
          <DataTableFilterControls />
        </div>
        <div className="flex max-w-full flex-1 flex-col gap-4 overflow-hidden p-1">
          <DataTableFilterCommand
            schema={filterSchema.definition}
            tableId="default"
          />
          <DataTableToolbar />
          <div className="rounded-md border">
            <Table>
              <TableHeader className="bg-muted/50">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow
                    key={headerGroup.id}
                    className="hover:bg-transparent"
                  >
                    {headerGroup.headers.map((header) => {
                      return (
                        <TableHead key={header.id}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext(),
                              )}
                        </TableHead>
                      );
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && "selected"}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center"
                    >
                      No results.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <DataTablePagination />
        </div>
      </div>
    </DataTableProvider>
  );
}

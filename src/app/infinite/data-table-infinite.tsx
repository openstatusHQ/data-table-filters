"use client";

import type {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  Table as TTable,
  VisibilityState,
} from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import * as React from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/custom/table";
import { DataTableFilterControls } from "@/_data-table/data-table-filter-controls";
import { DataTableFilterCommand } from "@/_data-table/data-table-filter-command";
import { columnFilterSchema } from "@/_data-table/schema";
import type { DataTableFilterField } from "@/_data-table/types";
import { DataTableToolbar } from "@/_data-table/data-table-toolbar"; // TODO: check where to put this
import { cn } from "@/lib/utils";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useQueryStates } from "nuqs";
import { searchParamsParser } from "@/_data-table/search-params";
import { type FetchNextPageOptions } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface DataTableInfiniteProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  defaultColumnFilters?: ColumnFiltersState;
  filterFields?: DataTableFilterField<TData>[];
  totalRows?: number;
  totalRowsFetched?: number;
  isFetching?: boolean;
  isLoading?: boolean;
  fetchNextPage: (options?: FetchNextPageOptions | undefined) => void;
}

export function DataTableInfinite<TData, TValue>({
  columns,
  data,
  defaultColumnFilters = [],
  filterFields = [],
  isFetching,
  isLoading,
  fetchNextPage,
  totalRows = 0,
  totalRowsFetched = 0,
}: DataTableInfiniteProps<TData, TValue>) {
  const [columnFilters, setColumnFilters] =
    React.useState<ColumnFiltersState>(defaultColumnFilters);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] =
    useLocalStorage<VisibilityState>("data-table-visibility", {});
  const [controlsOpen, setControlsOpen] = useLocalStorage(
    "data-table-controls",
    true
  );
  const topBarRef = React.useRef<HTMLDivElement>(null);
  const [topBarHeight, setTopBarHeight] = React.useState(0);
  const [_, setSearch] = useQueryStates(searchParamsParser);

  React.useEffect(() => {
    const observer = new ResizeObserver(() => {
      const rect = topBarRef.current?.getBoundingClientRect();
      if (rect) {
        setTopBarHeight(rect.height);
      }
    });

    const topBar = topBarRef.current;
    if (!topBar) return;

    observer.observe(topBar);
    return () => observer.unobserve(topBar);
  }, [topBarRef]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    function onScroll() {
      // TODO: add a threshold for the "Load More" button
      const onPageBottom =
        window.innerHeight + Math.round(window.scrollY) >=
        document.body.offsetHeight;
      if (onPageBottom && !isFetching && totalRowsFetched < totalRows) {
        fetchNextPage();
      }
    }

    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, [fetchNextPage, isFetching, totalRows, totalRowsFetched]);

  const table = useReactTable({
    data,
    columns,
    state: { columnFilters, sorting, columnVisibility },
    onColumnVisibilityChange: setColumnVisibility,
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedUniqueValues: (table: TTable<TData>, columnId: string) => () => {
      const map = getFacetedUniqueValues<TData>()(table, columnId)();
      // TODO: it would be great to do it dynamically, if we recognize the row to be Array.isArray
      if (["regions", "tags"].includes(columnId)) {
        const rowValues = table
          .getGlobalFacetedRowModel()
          .flatRows.map((row) => row.getValue(columnId) as string[]);
        for (const values of rowValues) {
          for (const value of values) {
            const prevValue = map.get(value) || 0;
            map.set(value, prevValue + 1);
          }
        }
      }
      return map;
    },
  });

  React.useEffect(() => {
    const columnFiltersWithNullable = filterFields.map((field) => {
      const filterValue = columnFilters.find(
        (filter) => filter.id === field.value
      );
      if (!filterValue) return { id: field.value, value: null };
      return { id: field.value, value: filterValue.value };
    });

    const search = columnFiltersWithNullable.reduce((prev, curr) => {
      prev[curr.id as string] = curr.value;
      return prev;
    }, {} as Record<string, unknown>);

    setSearch(search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnFilters]);

  return (
    <div className="flex w-full min-h-screen h-full flex-col sm:flex-row">
      <div
        className={cn(
          "w-full sm:min-w-52 sm:max-w-52 sm:self-start md:min-w-72 md:max-w-72 p-2",
          "sm:sticky sm:top-0 h-full max-h-screen overflow-y-scroll",
          !controlsOpen && "hidden"
        )}
      >
        <DataTableFilterControls
          table={table}
          columns={columns}
          filterFields={filterFields}
        />
      </div>
      <div className="flex max-w-full flex-1 flex-col sm:border-l border-border overflow-clip">
        <div
          ref={topBarRef}
          className={cn(
            "flex flex-col gap-4 bg-background p-2",
            "z-10 pb-4 sticky top-0"
          )}
        >
          <DataTableFilterCommand
            table={table}
            schema={columnFilterSchema}
            filterFields={filterFields}
            isLoading={isFetching || isLoading}
          />
          <DataTableToolbar
            table={table}
            controlsOpen={controlsOpen}
            setControlsOpen={setControlsOpen}
          />
        </div>
        <div className="z-0">
          <Table containerClassName="overflow-clip">
            <TableHeader
              className="sticky bg-muted"
              style={{ top: `${topBarHeight}px` }}
            >
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="hover:bg-transparent">
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {/* FIXME: should be getRowModel() as filtering */}
              {table.getCoreRowModel().rows?.length ? (
                table.getCoreRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
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
              <TableRow className="hover:bg-transparent data-[state=selected]:bg-transparent">
                <TableCell colSpan={columns.length} className="text-center">
                  {totalRowsFetched !== totalRows ||
                  !table.getCoreRowModel().rows?.length ? (
                    <Button
                      disabled={isFetching || isLoading}
                      onClick={() => fetchNextPage()}
                      size="sm"
                      variant="outline"
                    >
                      {isFetching ? (
                        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Load More
                    </Button>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      No more data to load (total:{" "}
                      <span className="font-medium">{totalRows} rows</span>)
                    </p>
                  )}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

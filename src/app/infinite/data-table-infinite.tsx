"use client";

import type {
  ColumnDef,
  ColumnFiltersState,
  RowSelectionState,
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
import { DataTableFilterControls } from "@/components/data-table/data-table-filter-controls";
import { DataTableFilterCommand } from "@/components/data-table/data-table-filter-command";
import { ColumnSchema, columnFilterSchema } from "./schema";
import type { DataTableFilterField } from "@/components/data-table/types";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar"; // TODO: check where to put this
import { cn } from "@/lib/utils";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useQueryStates } from "nuqs";
import { searchParamsParser } from "./search-params";
import { type FetchNextPageOptions } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SheetDetailsContent } from "./sheet-details-content";
import { Percentile } from "@/lib/request/percentile";
import { formatCompactNumber } from "@/lib/format";
import { inDateRange, arrSome } from "@/lib/table/filterfns";
import { SocialsFooter } from "@/components/layout/socials-footer";
import { DataTableSheetDetails } from "@/components/data-table/data-table-sheet-details";
import { TimelineChart } from "./timeline-chart";

// TODO: add a possible chartGroupBy
export interface DataTableInfiniteProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  defaultColumnFilters?: ColumnFiltersState;
  defaultColumnSorting?: SortingState;
  defaultRowSelection?: RowSelectionState;
  filterFields?: DataTableFilterField<TData>[];
  totalRows?: number;
  filterRows?: number;
  totalRowsFetched?: number;
  currentPercentiles?: Record<Percentile, number>;
  chartData?: { timestamp: number; [key: string]: number }[];
  isFetching?: boolean;
  isLoading?: boolean;
  fetchNextPage: (options?: FetchNextPageOptions | undefined) => void;
}

export function DataTableInfinite<TData, TValue>({
  columns,
  data,
  defaultColumnFilters = [],
  defaultColumnSorting = [],
  defaultRowSelection = {},
  filterFields = [],
  isFetching,
  isLoading,
  fetchNextPage,
  totalRows = 0,
  filterRows = 0,
  totalRowsFetched = 0,
  currentPercentiles,
  chartData = [],
}: DataTableInfiniteProps<TData, TValue>) {
  const [columnFilters, setColumnFilters] =
    React.useState<ColumnFiltersState>(defaultColumnFilters);
  const [sorting, setSorting] =
    React.useState<SortingState>(defaultColumnSorting);
  const [rowSelection, setRowSelection] =
    React.useState<RowSelectionState>(defaultRowSelection);
  const [columnOrder, setColumnOrder] = useLocalStorage<string[]>(
    "data-table-column-order",
    []
  );
  const [columnVisibility, setColumnVisibility] =
    useLocalStorage<VisibilityState>("data-table-visibility", {
      uuid: false,
      "timing.dns": false,
      "timing.connection": false,
      "timing.tls": false,
      "timing.ttfb": false,
      "timing.transfer": false,
    });
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
      if (onPageBottom && !isFetching && totalRowsFetched < filterRows) {
        fetchNextPage();
      }
    }

    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, [fetchNextPage, isFetching, filterRows, totalRowsFetched]);

  const table = useReactTable({
    data,
    columns,
    state: {
      columnFilters,
      sorting,
      columnVisibility,
      rowSelection,
      columnOrder,
    },
    enableMultiRowSelection: false,
    // @ts-ignore FIXME: because it is not in the types
    getRowId: (row, index) => `${row?.uuid}` || `${index}`,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnOrderChange: setColumnOrder,
    getSortedRowModel: getSortedRowModel(),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: (table: TTable<TData>, columnId: string) => () => {
      const map = getFacetedUniqueValues<TData>()(table, columnId)();
      // TODO: it would be great to do it dynamically, if we recognize the row to be Array.isArray
      if (["regions"].includes(columnId)) {
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
    filterFns: { inDateRange, arrSome },
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

  React.useEffect(() => {
    setSearch({ sort: sorting?.[0] || null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorting]);

  const selectedRow = React.useMemo(() => {
    const selectedRowKey = Object.keys(rowSelection)?.[0];
    return table
      .getCoreRowModel()
      .flatRows.find((row) => row.id === selectedRowKey);
  }, [rowSelection, table]);

  // FIXME: cannot share a uuid with the sheet details
  React.useEffect(() => {
    if (Object.keys(rowSelection)?.length && !selectedRow) {
      setSearch({ uuid: null });
      setRowSelection({});
    } else {
      setSearch({ uuid: Object.keys(rowSelection)?.[0] || null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowSelection, selectedRow]);

  return (
    <>
      <div className="flex w-full min-h-screen h-full flex-col sm:flex-row">
        <div
          className={cn(
            "w-ful h-full sm:min-w-52 sm:max-w-52 sm:self-start md:min-w-72 md:max-w-72 sm:sticky sm:top-0 sm:max-h-screen sm:overflow-y-scroll",
            !controlsOpen && "hidden"
          )}
        >
          <div className="p-2 flex-1">
            <DataTableFilterControls
              table={table}
              columns={columns}
              filterFields={filterFields}
            />
          </div>
          <Separator className="my-2" />
          <div className="p-2">
            <SocialsFooter />
          </div>
        </div>
        <div
          className={cn(
            "flex max-w-full flex-1 flex-col sm:border-l border-border overflow-clip",
            // Chrome issue
            controlsOpen &&
              "sm:max-w-[calc(100vw_-_208px)] md:max-w-[calc(100vw_-_288px)]"
          )}
        >
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
              isLoading={isFetching || isLoading}
              enableColumnOrdering={true}
            />
            <TimelineChart
              data={chartData}
              className="-mb-2"
              handleFilter={table.getColumn("date")?.setFilterValue}
            />
          </div>
          <div className="z-0">
            <Table containerClassName="overflow-clip">
              <TableHeader
                className="sticky bg-muted z-20"
                style={{ top: `${topBarHeight}px` }}
              >
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow
                    key={headerGroup.id}
                    className="hover:bg-transparent"
                  >
                    {headerGroup.headers.map((header) => {
                      return (
                        <TableHead
                          key={header.id}
                          className={
                            header.column.columnDef.meta?.headerClassName
                          }
                        >
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
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && "selected"}
                      onClick={() => row.toggleSelected()}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          className={
                            cell.column.columnDef.meta?.headerClassName
                          }
                        >
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
                    {totalRowsFetched < filterRows ||
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
                        <span className="font-medium font-mono">
                          {formatCompactNumber(totalRows)}
                        </span>{" "}
                        rows)
                      </p>
                    )}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
      <DataTableSheetDetails
        // TODO: make it dynamic via renderSheetDetailsContent
        title={(selectedRow?.original as ColumnSchema | undefined)?.pathname}
        titleClassName="font-mono"
        table={table}
      >
        <SheetDetailsContent
          data={selectedRow?.original as ColumnSchema}
          percentiles={currentPercentiles}
          filterRows={filterRows}
        />
      </DataTableSheetDetails>
    </>
  );
}

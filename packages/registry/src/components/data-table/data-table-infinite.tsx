"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@dtf/registry/components/custom/table";
import { DataTableFilterControls } from "@dtf/registry/components/data-table/data-table-filter-controls";
import { DataTableProvider } from "@dtf/registry/components/data-table/data-table-provider";
import { DataTableResetButton } from "@dtf/registry/components/data-table/data-table-reset-button";
import { DataTableToolbar } from "@dtf/registry/components/data-table/data-table-toolbar"; // TODO: check where to put this
import type { DataTableFilterField } from "@dtf/registry/components/data-table/types";
import { Button } from "@dtf/registry/components/ui/button";
import { useHotKey } from "@dtf/registry/hooks/use-hot-key";
import { useLocalStorage } from "@dtf/registry/hooks/use-local-storage";
import {
  getColumnOrderKey,
  getColumnVisibilityKey,
} from "@dtf/registry/lib/constants/local-storage";
import { formatCompactNumber } from "@dtf/registry/lib/format";
import { useFilterActions } from "@dtf/registry/lib/store/hooks/useFilterActions";
import { useFilterState } from "@dtf/registry/lib/store/hooks/useFilterState";
import {
  dataTableFeatures,
  type DataTableFeatures,
} from "@dtf/registry/lib/table/features";
import { cn } from "@dtf/registry/lib/utils";
import {
  type FetchNextPageOptions,
  type FetchPreviousPageOptions,
  type RefetchOptions,
} from "@tanstack/react-query";
import type {
  ColumnDef,
  ColumnFiltersState,
  ColumnVisibilityState,
  Row,
  RowData,
  RowSelectionState,
  SortingState,
  TableOptions,
  Table as TTable,
} from "@tanstack/react-table";
import { flexRender, Subscribe, useTable } from "@tanstack/react-table";
import { LoaderCircle } from "lucide-react";
import * as React from "react";
import { canLoadMore } from "./utils";

// TODO: add a possible chartGroupBy
/**
 * BREAKING (v9): the `TValue` type parameter is gone.
 *
 * It forced every column in the array to share one cell-value type, which was
 * never true. v9 makes per-column `TValue` explicit (`ColumnDef<TFeatures,
 * TData, TValue>`, and `columnHelper.columns([...])` to preserve it), and the
 * `columns` table option is typed against the default `CellData`. Every call
 * site in this repo passed `unknown` anyway.
 */
export interface DataTableInfiniteProps<TData extends RowData> {
  columns: ColumnDef<DataTableFeatures, TData>[];
  getRowClassName?: (row: Row<DataTableFeatures, TData>) => string;
  // REMINDER: make sure to pass the correct id to access the rows
  getRowId?: TableOptions<DataTableFeatures, TData>["getRowId"];
  data: TData[];
  defaultColumnFilters?: ColumnFiltersState;
  defaultColumnSorting?: SortingState;
  defaultRowSelection?: RowSelectionState;
  defaultColumnVisibility?: ColumnVisibilityState;
  filterFields?: DataTableFilterField<TData>[];
  // REMINDER: close to the same signature as the `facetedUniqueValues` slot on
  // `tableFeatures()`, but resolved rather than curried
  getFacetedUniqueValues?: (
    table: TTable<DataTableFeatures, TData>,
    columnId: string,
  ) => Map<string, number>;
  getFacetedMinMaxValues?: (
    table: TTable<DataTableFeatures, TData>,
    columnId: string,
  ) => undefined | [number, number];
  totalRows?: number;
  /**
   * How many rows match the active filters, as reported by the server.
   *
   * Must be authoritative relative to what `fetchNextPage` can actually return:
   * both the "Load More" button (`canLoadMore`) and the scroll auto-load stop
   * once `totalRowsFetched` reaches it. A value that under-reports the real
   * count makes the remaining rows unreachable, because there is no other way
   * to trigger a fetch. Leave it undefined rather than pass a guess — the
   * button then falls back to `hasNextPage` alone.
   */
  filterRows?: number;
  totalRowsFetched?: number;
  isFetching?: boolean;
  isLoading?: boolean;
  hasNextPage?: boolean;
  fetchNextPage: (
    options?: FetchNextPageOptions | undefined,
  ) => Promise<unknown>;
  fetchPreviousPage?: (
    options?: FetchPreviousPageOptions | undefined,
  ) => Promise<unknown>;
  refetch: (options?: RefetchOptions | undefined) => void;
  renderLiveRow?: (props?: {
    row: Row<DataTableFeatures, TData>;
  }) => React.ReactNode;
  // Used to store column order and visibility in local storage for specific data-table namespace
  tableId?: string;
  // Optional slots for extensibility
  commandSlot?: React.ReactNode;
  sheetSlot?: React.ReactNode;
  toolbarActions?: React.ReactNode;
  chartSlot?: React.ReactNode;
  footerSlot?: React.ReactNode;
  floatingBarSlot?: React.ReactNode;
  className?: string;
}

export function DataTableInfinite<TData extends RowData>({
  columns,
  getRowClassName,
  getRowId,
  data,
  defaultColumnFilters = [],
  defaultColumnSorting = [],
  defaultRowSelection = {},
  defaultColumnVisibility = {},
  filterFields = [],
  isFetching,
  isLoading,
  fetchNextPage,
  hasNextPage,
  fetchPreviousPage,
  refetch,
  totalRows,
  filterRows,
  totalRowsFetched = 0,
  getFacetedUniqueValues,
  getFacetedMinMaxValues,
  renderLiveRow,
  tableId = "infinite",
  commandSlot,
  sheetSlot,
  toolbarActions,
  chartSlot,
  footerSlot,
  floatingBarSlot,
  className,
}: DataTableInfiniteProps<TData>) {
  const [columnFilters, setColumnFilters] =
    React.useState<ColumnFiltersState>(defaultColumnFilters);
  const [sorting, setSorting] =
    React.useState<SortingState>(defaultColumnSorting);
  const [rowSelection, setRowSelection] =
    React.useState<RowSelectionState>(defaultRowSelection);
  const [columnOrder, setColumnOrder] = useLocalStorage<string[]>(
    getColumnOrderKey(tableId),
    [],
  );
  const [columnVisibility, setColumnVisibility] =
    useLocalStorage<ColumnVisibilityState>(
      getColumnVisibilityKey(tableId),
      defaultColumnVisibility,
    );
  const topBarRef = React.useRef<HTMLDivElement>(null);
  const tableRef = React.useRef<HTMLTableElement>(null);
  const [topBarHeight, setTopBarHeight] = React.useState(0);

  // Detect if a select column exists to enable multi-row selection
  const hasSelectColumn = React.useMemo(
    () => columns.some((col) => col.meta?.kind === "select"),
    [columns],
  );

  const onScroll = React.useCallback(
    (e: React.UIEvent<HTMLElement>) => {
      const onPageBottom =
        Math.ceil(e.currentTarget.scrollTop + e.currentTarget.clientHeight) >=
        e.currentTarget.scrollHeight;

      if (onPageBottom && !isFetching && totalRowsFetched < (filterRows ?? 0)) {
        fetchNextPage();
      }
    },
    [fetchNextPage, isFetching, filterRows, totalRowsFetched],
  );

  // See `canLoadMore` — `hasNextPage` stays true past the final row because the
  // API only signals the end with an empty page.
  const hasMoreToLoad = canLoadMore({
    hasNextPage,
    filterRows,
    totalRowsFetched,
  });

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

  const table = useTable({
    // Row models, filter fns and sort fns all live on the feature set in v9 —
    // see `lib/table/features.ts`.
    features: dataTableFeatures,
    // This table paginates on the server (cursor-based, via `fetchNextPage`), so
    // client pagination must be off. It is not optional: the shared feature set
    // registers `paginatedRowModel` for the paginated blocks, and v9 routes
    // `getRowModel()` through it whenever that slot exists and this flag is
    // falsy — silently truncating every page to the default pageSize of 10.
    manualPagination: true,
    data,
    columns,
    state: {
      columnFilters,
      sorting,
      columnVisibility,
      rowSelection,
      columnOrder,
    },
    enableMultiRowSelection: hasSelectColumn,
    columnResizeMode: "onChange",
    getRowId,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnOrderChange: setColumnOrder,
    debugAll: process.env.NEXT_PUBLIC_TABLE_DEBUG === "true",
    meta: { getRowClassName },
  });

  // Clear multi-select when filters or sorting change
  React.useEffect(() => {
    if (hasSelectColumn) {
      setRowSelection({});
    }
  }, [columnFilters, sorting, hasSelectColumn, setRowSelection]);

  // NOTE: Filter, sort, and selection syncing is now handled by DataTableStoreSync

  /**
   * https://tanstack.com/table/latest/docs/guide/column-sizing#advanced-column-resizing-performance
   * Instead of calling `column.getSize()` on every render for every header
   * and especially every data cell (very expensive),
   * we will calculate all column sizes at once at the root table level in a useMemo
   * and pass the column sizes down as CSS variables to the <table> element.
   */
  const columnSizeVars = React.useMemo(() => {
    const headers = table.getFlatHeaders();
    const colSizes: { [key: string]: string } = {};
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i]!;
      // REMINDER: replace "." with "-" to avoid invalid CSS variable name (e.g. "timing.dns" -> "timing-dns")
      colSizes[`--header-${header.id.replaceAll(".", "-")}-size`] =
        `${header.getSize()}px`;
      colSizes[`--col-${header.column.id.replaceAll(".", "-")}-size`] =
        `${header.column.getSize()}px`;
    }
    return colSizes;
  }, [
    table.state.columnResizing,
    table.state.columnSizing,
    table.state.columnVisibility,
  ]);

  useHotKey(() => {
    setColumnOrder([]);
    setColumnVisibility(defaultColumnVisibility);
  }, "u");

  // Read BYOS uuid for detail row visual state (only used in multi-select mode)
  const detailRowId = useFilterState((s) => s.uuid) as
    | string
    | null
    | undefined;
  const { setFilters } = useFilterActions();

  // Stable callback for row clicks — lifted here so Row doesn't need useFilterActions
  const onRowClick = React.useCallback(
    (row: Row<DataTableFeatures, TData>) => {
      if (hasSelectColumn) {
        setFilters({ uuid: detailRowId === row.id ? null : row.id });
      } else {
        row.toggleSelected();
      }
    },
    [hasSelectColumn, detailRowId, setFilters],
  );

  return (
    <DataTableProvider
      table={table}
      columns={columns}
      filterFields={filterFields}
      columnFilters={columnFilters}
      sorting={sorting}
      rowSelection={rowSelection}
      columnOrder={columnOrder}
      columnVisibility={columnVisibility}
      enableColumnOrdering={true}
      isLoading={isFetching || isLoading}
      totalRows={totalRows}
      filterRows={filterRows ?? table.getFilteredRowModel().rows.length}
      getFacetedUniqueValues={getFacetedUniqueValues}
      getFacetedMinMaxValues={getFacetedMinMaxValues}
    >
      <div
        className="flex h-full min-h-screen w-full flex-col sm:flex-row"
        style={
          {
            "--top-bar-height": `${topBarHeight}px`,
            ...columnSizeVars,
          } as React.CSSProperties
        }
      >
        <div
          className={cn(
            "h-full w-full flex-col sm:sticky sm:top-0 sm:max-h-screen sm:min-h-screen sm:max-w-52 sm:min-w-52 sm:self-start md:max-w-72 md:min-w-72",
            "group-data-[expanded=false]/controls:hidden",
            "hidden sm:flex",
          )}
        >
          <div className="border-border bg-background border-b p-2 md:sticky md:top-0">
            <div className="flex h-[46px] items-center justify-between gap-3">
              <p className="text-foreground px-2 font-medium">Filters</p>
              <div>
                {table.state.columnFilters.length ? (
                  <DataTableResetButton />
                ) : null}
              </div>
            </div>
          </div>
          {/* REMINDER: no top padding - it would offset the first filter row */}
          <div className="flex-1 px-2 pb-2 sm:overflow-y-scroll">
            <DataTableFilterControls />
          </div>
          {footerSlot ? (
            <div className="border-border bg-background border-t p-4 md:sticky md:bottom-0">
              {footerSlot}
            </div>
          ) : null}
        </div>
        <div
          className={cn(
            "border-border flex max-w-full flex-1 flex-col sm:border-l",
            // Chrome issue
            "sm:group-data-[expanded=true]/controls:max-w-[calc(100%-208px)] md:group-data-[expanded=true]/controls:max-w-[calc(100%-288px)]",
          )}
        >
          <div
            ref={topBarRef}
            className={cn(
              "bg-background flex flex-col gap-4 p-2",
              "sticky top-0 z-10 pb-4",
            )}
          >
            {commandSlot}
            {/* TBD: better flexibility with compound components? */}
            <DataTableToolbar
              renderActions={toolbarActions ? () => toolbarActions : undefined}
            />
            {chartSlot}
          </div>
          <div className="z-0">
            <Table
              ref={tableRef}
              onScroll={onScroll}
              // REMINDER: https://stackoverflow.com/questions/50361698/border-style-do-not-work-with-sticky-position-element
              className="border-separate border-spacing-0"
              containerClassName="max-h-[calc(100vh-var(--top-bar-height))]"
            >
              <TableHeader className={cn("bg-background sticky top-0 z-20")}>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow
                    key={headerGroup.id}
                    className={cn(
                      "bg-muted/50 hover:bg-muted/50",
                      "*:border-t [&>:not(:last-child)]:border-r",
                    )}
                  >
                    {headerGroup.headers.map((header) => {
                      return (
                        <TableHead
                          key={header.id}
                          style={
                            header.column.getCanResize()
                              ? {
                                  width: `var(--header-${header.id.replaceAll(".", "-")}-size)`,
                                  minWidth: `var(--header-${header.id.replaceAll(".", "-")}-size)`,
                                }
                              : header.column.columnDef.maxSize
                                ? {
                                    width: `var(--header-${header.id.replaceAll(".", "-")}-size)`,
                                    minWidth: `var(--header-${header.id.replaceAll(".", "-")}-size)`,
                                    maxWidth: `var(--header-${header.id.replaceAll(".", "-")}-size)`,
                                  }
                                : undefined
                          }
                          className={cn(
                            "border-border relative truncate border-b select-none last:[&>.cursor-col-resize]:opacity-0",
                            header.column.columnDef.meta?.headerClassName,
                          )}
                          aria-sort={
                            header.column.getIsSorted() === "asc"
                              ? "ascending"
                              : header.column.getIsSorted() === "desc"
                                ? "descending"
                                : "none"
                          }
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext(),
                              )}
                          {header.column.getCanResize() && (
                            <div
                              onDoubleClick={() => header.column.resetSize()}
                              onMouseDown={header.getResizeHandler()}
                              onTouchStart={header.getResizeHandler()}
                              className={cn(
                                "user-select-none absolute top-0 -right-2 z-10 flex h-full w-4 cursor-col-resize touch-none justify-center",
                                "before:bg-border before:absolute before:inset-y-0 before:w-px before:translate-x-px",
                              )}
                            />
                          )}
                        </TableHead>
                      );
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody
                id="content"
                tabIndex={-1}
                className="outline-primary outline-1 -outline-offset-1 transition-colors outline-none focus-visible:outline-solid"
                // REMINDER: avoids scroll (skipping the table header) when using skip to content
                style={{
                  scrollMarginTop: "calc(var(--top-bar-height) + 40px)",
                }}
              >
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    // REMINDER: if we want to add arrow navigation https://github.com/TanStack/table/discussions/2752#discussioncomment-192558
                    <React.Fragment key={row.id}>
                      {renderLiveRow?.({ row })}
                      <MemoizedRow
                        row={row}
                        selected={row.getIsSelected()}
                        detailRowId={hasSelectColumn ? detailRowId : undefined}
                        onRowClick={onRowClick}
                      />
                    </React.Fragment>
                  ))
                ) : (
                  <React.Fragment>
                    {renderLiveRow?.()}
                    <TableRow>
                      <TableCell
                        colSpan={columns.length}
                        className="h-24 text-center"
                      >
                        No results.
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                )}
                <TableRow className="hover:bg-transparent data-[state=selected]:bg-transparent">
                  <TableCell colSpan={columns.length} className="text-center">
                    {hasMoreToLoad || isFetching || isLoading ? (
                      <Button
                        disabled={isFetching || isLoading}
                        onClick={() => fetchNextPage()}
                        variant="outline"
                      >
                        {isFetching ? (
                          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        Load More
                      </Button>
                    ) : (
                      <p className="text-muted-foreground text-sm">
                        No more data to load (
                        <span className="font-mono font-medium">
                          {formatCompactNumber(filterRows ?? 0)}
                        </span>{" "}
                        of{" "}
                        <span className="font-mono font-medium">
                          {formatCompactNumber(totalRows ?? 0)}
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
      {sheetSlot}
      {floatingBarSlot}
    </DataTableProvider>
  );
}

/**
 * REMINDER: this is the heaviest component in the table if lots of rows
 * Some other components are rendered more often necessary, but are fixed size (not like rows that can grow in height)
 * e.g. DataTableFilterControls, DataTableFilterCommand, DataTableToolbar, DataTableHeader
 */

function Row<TData extends RowData>({
  row,
  selected,
  detailRowId,
  onRowClick,
}: {
  row: Row<DataTableFeatures, TData>;
  // REMINDER: row.getIsSelected(); - just for memoization
  selected?: boolean;
  // When multi-select is enabled, the BYOS uuid for detail sheet (undefined = single-select mode)
  detailRowId?: string | null;
  onRowClick: (row: Row<DataTableFeatures, TData>) => void;
}) {
  // REMINDER: rerender the row when live mode is toggled - used to opacity the row
  // via the `getRowClassName` prop - but for some reasons it wil render the row on data fetch
  useFilterState((s) => s.live);

  const isMultiSelect = detailRowId !== undefined;
  const isDetail = isMultiSelect && detailRowId === row.id;

  const handleClick = React.useCallback(() => {
    onRowClick(row);
  }, [onRowClick, row]);

  return (
    <TableRow
      id={row.id}
      tabIndex={0}
      // Single-select: data-state="selected" for the selected row
      // Multi-select: data-detail + data-checked are independent (a row can be both)
      data-state={!isMultiSelect && selected ? "selected" : undefined}
      data-detail={isDetail ? "" : undefined}
      data-checked={isMultiSelect && selected ? "" : undefined}
      onClick={handleClick}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          handleClick();
        }
      }}
      className={cn(
        "[&>:not(:last-child)]:border-r",
        "outline-primary focus-visible:bg-muted/50 outline-1 -outline-offset-1 transition-colors outline-none focus-visible:outline-solid",
        "data-[state=selected]:outline-solid",
        "data-detail:outline-solid",
        "data-checked:bg-muted/50",
        row.table.options.meta?.getRowClassName?.(row),
      )}
    >
      {/*
        REMINDER: `row.getVisibleCells()` reads `columnVisibility` and
        `columnOrder` behind a method call, which the React Compiler cannot see.
        Compiled, it caches the cells on `row` identity alone, so toggling or
        reordering a column would leave this row rendering its old cells — and
        `React.memo` below means no parent re-render can fix that. `Subscribe`
        re-runs this callback when those slices change, which is what lets the
        rest of the file stay compiled instead of opting out with "use no memo".
        https://tanstack.com/table/latest/docs/framework/react/guide/react-compiler
      */}
      <Subscribe
        source={row.table.store}
        selector={(state) => ({
          columnVisibility: state.columnVisibility,
          columnOrder: state.columnOrder,
        })}
      >
        {() =>
          row.getVisibleCells().map((cell) => (
            <TableCell
              key={cell.id}
              style={
                cell.column.getCanResize()
                  ? {
                      width: `var(--col-${cell.column.id.replaceAll(".", "-")}-size)`,
                      maxWidth: `var(--col-${cell.column.id.replaceAll(".", "-")}-size)`,
                    }
                  : cell.column.columnDef.maxSize
                    ? {
                        width: `var(--col-${cell.column.id.replaceAll(".", "-")}-size)`,
                        minWidth: `var(--col-${cell.column.id.replaceAll(".", "-")}-size)`,
                        maxWidth: `var(--col-${cell.column.id.replaceAll(".", "-")}-size)`,
                      }
                    : undefined
              }
              className={cn(
                "border-border truncate border-b",
                cell.column.columnDef.meta?.cellClassName,
              )}
            >
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </TableCell>
          ))
        }
      </Subscribe>
    </TableRow>
  );
}

/**
 * REMINDER: this comparator cannot be dropped in favour of the React Compiler.
 * `createCoreRowModel` memoizes on `[table.options.data]`, so every
 * `fetchNextPage` rebuilds the core row model and hands back a *new* `row`
 * object for every already-rendered row. Comparing by `row.id` says "same row,
 * same render" — a fact about this table that the compiler cannot infer, since
 * it can only ever key on the identity it is given. Without it, each page fetch
 * re-runs `cn()` (tailwind-merge), `getVisibleCells()` and a full reconcile for
 * every row on screen, and that count only grows as you scroll.
 */
const MemoizedRow = React.memo(
  Row,
  (prev, next) =>
    prev.row.id === next.row.id &&
    prev.selected === next.selected &&
    prev.detailRowId === next.detailRowId &&
    prev.onRowClick === next.onRowClick,
) as typeof Row;

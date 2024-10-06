import "@tanstack/react-table";

declare module "@tanstack/react-table" {
  interface ColumnMeta {
    headerClassName?: string;
    cellClassName?: string;
    label?: string;
  }

  interface FilterFns {
    inDateRange?: FilterFn<any>;
    arrSome?: FilterFn<any>;
  }

  // https://github.com/TanStack/table/discussions/4554
  interface ColumnFiltersOptions<TData extends RowData> {
    filterFns?: Record<string, FilterFn<TData>>;
  }
}

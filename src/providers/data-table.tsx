import { DataTableFilterField } from "@/components/data-table/types";
import type {
  ColumnDef,
  ColumnFiltersState,
  RowSelectionState,
  SortingState,
  Table,
  VisibilityState,
} from "@tanstack/react-table";
import { createContext, useContext, useMemo } from "react";
import { ControlsProvider } from "./controls";

// REMINDER: read about how to move controlled state out of the useReactTable hook
// https://github.com/TanStack/table/discussions/4005#discussioncomment-7303569

interface DataTableContextType<TData = unknown, TValue = unknown> {
  table: Table<TData>;
  filterFields: DataTableFilterField<TData>[];
  columns: ColumnDef<TData, TValue>[];
  enableColumnOrdering: boolean;
  isLoading?: boolean;
  // REMINDER: controlled state, allowing to rerender the component on state changes
  columnFilters: ColumnFiltersState;
  sorting: SortingState;
  rowSelection: RowSelectionState;
  columnOrder: string[];
  columnVisibility: VisibilityState;
  getFacetedUniqueValues?: (
    table: Table<TData>,
    columnId: string
  ) => Map<string, number>;
  getFacetedMinMaxValues?: (
    table: Table<TData>,
    columnId: string
  ) => undefined | [number, number];
}

export const DataTableContext = createContext<DataTableContextType<
  any,
  any
> | null>(null);

export function DataTableProvider<TData, TValue>({
  children,
  ...props
}: DataTableContextType<TData, TValue> & {
  children: React.ReactNode;
}) {
  const value = useMemo(
    () => ({ ...props }),
    [
      props.columnFilters,
      props.sorting,
      props.rowSelection,
      props.columnOrder,
      props.columnVisibility,
      props.table,
      props.filterFields,
      props.columns,
      props.enableColumnOrdering,
      props.isLoading,
      props.getFacetedUniqueValues,
      props.getFacetedMinMaxValues,
    ]
  );

  return (
    <DataTableContext.Provider value={value}>
      <ControlsProvider>{children}</ControlsProvider>
    </DataTableContext.Provider>
  );
}

export function useDataTable<TData, TValue>() {
  const context = useContext(DataTableContext);

  if (!context) {
    throw new Error("useDataTable must be used within a DataTableProvider");
  }

  return context as DataTableContextType<TData, TValue>;
}

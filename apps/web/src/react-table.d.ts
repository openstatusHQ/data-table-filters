import "@tanstack/react-table";

declare module "@tanstack/react-table" {
  // https://github.com/TanStack/table/issues/44#issuecomment-1377024296
  //
  // v9 also offers per-table `tableMeta`/`columnMeta` slots on `tableFeatures()`,
  // which avoid augmenting a global. They are not usable here: the meta types
  // below reference `Row<TFeatures, TData>`, and a slot lives inside the very
  // features object whose type would have to be named to write that reference.
  // Declaration merging takes `TFeatures` as a parameter instead, so it stays
  // valid for any feature set a consumer builds.
  interface TableMeta<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    getRowClassName?: (row: Row<TFeatures, TData>) => string;
  }

  interface ColumnMeta<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
    TValue extends CellData = CellData,
  > {
    headerClassName?: string;
    cellClassName?: string;
    label?: string;
    kind?: string;
  }

  // NOTE: v8 needed a `FilterFns` augmentation plus a `ColumnFiltersOptions`
  // workaround (https://github.com/TanStack/table/discussions/4554) to register
  // `inDateRange`/`arrSome`. In v9 both are replaced by the `filterFns` slot on
  // `tableFeatures()` — see `lib/table/features.ts`.
}

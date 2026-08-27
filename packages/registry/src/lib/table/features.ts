import { getFacetedUniqueValuesFlattened } from "@dtf/registry/lib/data-table/faceted";
import {
  columnFacetingFeature,
  columnFilteringFeature,
  columnOrderingFeature,
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  createFacetedMinMaxValues,
  createFacetedRowModel,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_arrIncludes,
  filterFn_arrIncludesSome,
  filterFn_equals,
  filterFn_includesString,
  filterFn_inNumberRange,
  filterFn_weakEquals,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
} from "@tanstack/react-table";
import { arrSome, inDateRange } from "./filterfns";

/**
 * The feature set every data-table block is built against.
 *
 * TanStack Table v9 no longer bundles features implicitly — each one has to be
 * registered here, along with the row-model factory that powers it. Registering
 * the set in one module (rather than per table) keeps the blocks consistent and
 * gives consumers a single file to edit when they need a feature we don't ship.
 *
 * Deliberately *not* `stockFeatures`: that pulls in all 17 stock features plus
 * every built-in filter/sort function, which defeats the point of shipping
 * installable blocks with a small footprint.
 */
export const dataTableFeatures = tableFeatures({
  columnFilteringFeature,
  filteredRowModel: createFilteredRowModel(),

  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),

  columnFacetingFeature,
  facetedRowModel: createFacetedRowModel(),
  facetedMinMaxValues: createFacetedMinMaxValues(),
  // Array columns are a first-class citizen here (`regions: ["ams", "fra"]`),
  // so the flattening variant is the default rather than an opt-in: the stock
  // factory would count `["ams", "fra"]` as a single facet value.
  facetedUniqueValues: getFacetedUniqueValuesFlattened(),

  columnVisibilityFeature,
  columnOrderingFeature,
  rowSelectionFeature,

  // v8's single `ColumnSizing` is split in two: sizes vs. the drag interaction.
  columnSizingFeature,
  columnResizingFeature,

  /**
   * Only the paginated blocks use this, but the registry ships one feature set:
   * `TFeatures` is invariant, so a second set could not share the provider or
   * any shared component type.
   *
   * Registering it is NOT free. `getRowModel()` routes through
   * `paginatedRowModel` whenever this slot exists and `manualPagination` is
   * falsy, so any table that paginates server-side (`DataTableInfinite`) must
   * set `manualPagination: true` or it silently renders only the first
   * `pageSize` (default 10) rows of each fetch.
   */
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),

  /**
   * `columnDef.filterFn` defaults to `'auto'`, which resolves by data type to
   * one of `includesString | inNumberRange | equals | arrIncludes |
   * inDateRange | weakEquals`. In v9 an unregistered name does not filter at
   * all (it warns in dev and returns `undefined`), so the whole auto set has to
   * be present for columns that don't name a filter explicitly.
   *
   * `inDateRange` intentionally shadows the v9 built-in of the same name: ours
   * treats a missing end date as "same day" and uses inclusive bounds so the
   * client agrees with server-side filtering. That equivalence is pinned by
   * `lib/filters/__tests__/conformance-tanstack.test.ts`.
   */
  filterFns: {
    includesString: filterFn_includesString,
    inNumberRange: filterFn_inNumberRange,
    equals: filterFn_equals,
    arrIncludes: filterFn_arrIncludes,
    arrIncludesSome: filterFn_arrIncludesSome,
    weakEquals: filterFn_weakEquals,
    inDateRange,
    arrSome,
  },

  /**
   * `columnDef.sortFn` also defaults to `'auto'`, which resolves to `datetime`,
   * `alphanumeric`, or `text`. Unlike filters, an unregistered sort name falls
   * back to `sortFn_basic` — correct for numbers, wrong for dates and mixed
   * alphanumeric strings, so these three are registered.
   */
  sortFns: {
    datetime: sortFn_datetime,
    alphanumeric: sortFn_alphanumeric,
    text: sortFn_text,
  },
});

/**
 * The feature set as a type, for the `TFeatures` parameter that v9 threads
 * through `Table`, `Row`, `Column`, `Cell` and `ColumnDef`.
 *
 * Every shared component pins this type rather than staying generic over
 * `TFeatures`. That is not a shortcut, it is the only thing that compiles:
 * `TFeatures` is invariant in v9 (`in out`), and TypeScript cannot resolve the
 * feature-map lookup behind an unresolved type parameter — so a component
 * generic over `TFeatures` can call no feature API at all (`getCanSort`,
 * `getFacetedRowModel`, …), and `Table<any, …>` is not a supertype to fall back
 * on either.
 *
 * Registering an extra feature therefore means editing `dataTableFeatures`
 * above. Because this type is `typeof dataTableFeatures`, every component
 * follows automatically — which is the shadcn-registry model anyway, since
 * these files are copied into your project.
 */
export type DataTableFeatures = typeof dataTableFeatures;

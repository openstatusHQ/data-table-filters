"use client";

import { DataTableInfinite } from "@dtf/registry/components/data-table/data-table-infinite";
import type {
  DataTableFilterField,
  SheetField,
} from "@dtf/registry/components/data-table/types";
import { useTableManifest } from "@dtf/registry/hooks/use-table-manifest";
import type { UseTableManifestOptions } from "@dtf/registry/hooks/use-table-manifest";
import {
  applyFacets,
  createDataTableQueryOptions,
  getFacetedMinMaxValues,
  getFacetedUniqueValues,
  type PaginationStrategy,
  type Transport,
} from "@dtf/registry/lib/data-table";
import { useNuqsAdapter } from "@dtf/registry/lib/store/adapters/nuqs";
import { useFilterState } from "@dtf/registry/lib/store/hooks/useFilterState";
import { DataTableStoreProvider } from "@dtf/registry/lib/store/provider/DataTableStoreProvider";
import { field } from "@dtf/registry/lib/store/schema";
import {
  applyRenderers,
  createRowAccessors,
  createTableSchema,
  generateColumns,
  generateFilterFields,
  generateFilterSchema,
  generateSheetFields,
  getDefaultColumnVisibility,
  type RendererOverrides,
  type TableChartConfig,
  type TableManifest,
} from "@dtf/registry/lib/table-schema";
import { useInfiniteQuery } from "@tanstack/react-query";
import * as React from "react";

/**
 * A data table that renders from an endpoint rather than from local code.
 *
 * Point it at a manifest URL and a list URL and it draws the columns, the
 * filters, the sheet, the counts and the row actions — none of which it knows
 * anything about at build time.
 *
 * ## Why two components
 *
 * The URL-state adapter's parsers are derived from the schema, and
 * `useNuqsAdapter(schema, …)` needs one at first render. A hook cannot be
 * called conditionally, so the manifest has to resolve one level above
 * everything built from it. `DataTableRemote` resolves it; `RemoteTable` is
 * mounted only once it has, and so has a stable hook order for its whole life.
 *
 * Remounting on a schema change is deliberate rather than incidental: table
 * state (sorting, visibility, filters) is keyed by column, and carrying it
 * across a schema swap resurrects state for columns that no longer exist.
 */

type RemoteRow = Record<string, unknown>;

export type DataTableRemoteProps = {
  /** `GET`s a `TableManifest`. See `createTableManifestHandler`. */
  manifestEndpoint: string;
  /** `GET`s rows. Defaults to `manifestEndpoint` with `/schema` stripped. */
  dataEndpoint?: string;
  /** Base URL, headers, credentials, response parsing. */
  transport?: Transport<RemoteRow[], unknown>;
  /** Defaults to a bidirectional timestamp cursor. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pagination?: PaginationStrategy<any>;
  /** Serializes filter state into a query string for the data endpoint. */
  searchParamsSerializer: (search: Record<string, unknown>) => string;
  /** A build-time snapshot or a server prefetch — skips the manifest round trip. */
  initialManifest?: TableManifest;
  manifestOptions?: Omit<UseTableManifestOptions, "initialManifest">;
  /**
   * Renderer closures to attach by column key.
   *
   * A schema crossing the wire carries named displays (`badge`, `bar`,
   * `status-code`, …) but not closures, so this is how an app draws the one or
   * two columns the named set does not cover while every other column stays
   * declarative. See `applyRenderers`.
   */
  renderers?: RendererOverrides;
  /** Distinguishes this table's URL state and query cache from another's. */
  tableId?: string;
  /** Rendered while the manifest is in flight. */
  loadingSlot?: React.ReactNode;
  /** Rendered when the manifest could not be loaded. */
  errorSlot?: (error: Error) => React.ReactNode;
  className?: string;
} & RemoteSlots;

/** Host-supplied pieces the manifest cannot describe. */
export type RemoteSlots = {
  commandSlot?: React.ReactNode;
  toolbarActions?: React.ReactNode;
  footerSlot?: React.ReactNode;
  floatingBarSlot?: React.ReactNode;
  /**
   * Given the chart points and the manifest's chart config, when the endpoint
   * says it has a chart. Not rendered at all when it does not.
   */
  chartSlot?: (
    chartData: unknown[],
    config: TableChartConfig | undefined,
  ) => React.ReactNode;
  sheetSlot?: (fields: SheetField<RemoteRow>[]) => React.ReactNode;
  /** Per-row styling, which no manifest field describes. */
  getRowClassName?: Parameters<
    typeof DataTableInfinite<RemoteRow>
  >[0]["getRowClassName"];
};

/** `/api/logs/schema` → `/api/logs`; anything else is returned unchanged. */
export function defaultDataEndpoint(manifestEndpoint: string): string {
  return manifestEndpoint.replace(/\/schema\/?$/, "") || "/";
}

export function DataTableRemote({
  manifestEndpoint,
  initialManifest,
  manifestOptions,
  loadingSlot,
  errorSlot,
  ...props
}: DataTableRemoteProps) {
  const query = useTableManifest(manifestEndpoint, {
    ...manifestOptions,
    ...(initialManifest ? { initialManifest } : {}),
  });

  if (query.error) {
    return <>{errorSlot?.(query.error) ?? null}</>;
  }
  if (!query.data) {
    return <>{loadingSlot ?? null}</>;
  }

  return (
    <RemoteTable
      // A schema change resets table state rather than carrying stale
      // per-column state across it.
      key={schemaIdentity(query.data)}
      manifest={query.data}
      manifestEndpoint={manifestEndpoint}
      {...props}
    />
  );
}

/**
 * A cheap identity for "is this the same schema".
 *
 * Deliberately not the HTTP ETag: that covers the whole manifest, including
 * capability and action changes, and remounting on those would throw away the
 * user's sorting for no reason. Only the column set can strand table state.
 */
export function schemaIdentity(manifest: TableManifest): string {
  return manifest.schema.columns.map((column) => column.key).join("|");
}

type RemoteTableProps = Omit<
  DataTableRemoteProps,
  "initialManifest" | "manifestOptions" | "loadingSlot" | "errorSlot"
> & { manifest: TableManifest };

function RemoteTable({
  manifest,
  manifestEndpoint,
  dataEndpoint,
  transport,
  pagination,
  searchParamsSerializer,
  renderers,
  tableId = "remote",
  ...slots
}: RemoteTableProps) {
  const definition = React.useMemo(() => {
    const { definition: base } = createTableSchema.fromJSON(manifest.schema);
    return renderers ? applyRenderers(base, renderers) : base;
  }, [manifest.schema, renderers]);

  const columns = React.useMemo(
    () => generateColumns<RemoteRow>(definition),
    [definition],
  );
  const filterFields = React.useMemo(
    () => generateFilterFields<RemoteRow>(definition),
    [definition],
  );
  const sheetFields = React.useMemo(
    () => generateSheetFields<RemoteRow>(definition),
    [definition],
  );
  const defaultColumnVisibility = React.useMemo(
    () => ({
      ...getDefaultColumnVisibility(definition),
      ...manifest.defaults?.columnVisibility,
    }),
    [definition, manifest.defaults?.columnVisibility],
  );

  // `sort` is spliced in before the schema is created so `defaults` cannot
  // disagree with `definition` — the same ordering the builder needs.
  const filterSchema = React.useMemo(
    () => generateFilterSchema(definition, { sort: field.sort() }),
    [definition],
  );

  const adapter = useNuqsAdapter(filterSchema.definition, { id: tableId });

  const queryOptions = React.useMemo(
    () =>
      createDataTableQueryOptions<RemoteRow[], unknown>({
        queryKeyPrefix: tableId,
        apiEndpoint: dataEndpoint ?? defaultDataEndpoint(manifestEndpoint),
        searchParamsSerializer,
        ...(transport ? { transport } : {}),
        ...(pagination ? { pagination } : {}),
      }),
    [
      tableId,
      dataEndpoint,
      manifestEndpoint,
      searchParamsSerializer,
      transport,
      pagination,
    ],
  );

  return (
    <DataTableStoreProvider adapter={adapter}>
      <RemoteTableQuery
        manifest={manifest}
        columns={columns}
        filterFields={filterFields}
        sheetFields={sheetFields}
        defaultColumnVisibility={defaultColumnVisibility}
        queryOptions={queryOptions}
        tableId={tableId}
        {...slots}
      />
    </DataTableStoreProvider>
  );
}

type RemoteTableQueryProps = RemoteSlots & {
  manifest: TableManifest;
  columns: ReturnType<typeof generateColumns<RemoteRow>>;
  filterFields: DataTableFilterField<RemoteRow>[];
  sheetFields: SheetField<RemoteRow>[];
  defaultColumnVisibility: Record<string, boolean>;
  queryOptions: ReturnType<
    typeof createDataTableQueryOptions<RemoteRow[], unknown>
  >;
  tableId: string;
  className?: string;
};

function RemoteTableQuery({
  manifest,
  columns,
  filterFields,
  sheetFields,
  defaultColumnVisibility,
  queryOptions,
  tableId,
  chartSlot,
  sheetSlot,
  getRowClassName,
  ...slots
}: RemoteTableQueryProps) {
  const search = useFilterState<Record<string, unknown>>();
  const { capabilities } = manifest;

  const {
    data,
    isFetching,
    isLoading,
    fetchNextPage,
    hasNextPage,
    fetchPreviousPage,
    refetch,
  } = useInfiniteQuery(queryOptions(search));

  const flatData = React.useMemo(
    () => data?.pages?.flatMap((page) => page.data ?? []) ?? [],
    [data?.pages],
  );

  const lastPage = data?.pages?.[data.pages.length - 1];
  const facets = capabilities.facets ? lastPage?.meta?.facets : undefined;
  const chartData = capabilities.chart ? lastPage?.meta?.chartData : undefined;

  const accessors = React.useMemo(
    () => createRowAccessors<RemoteRow>(manifest),
    [manifest],
  );

  const dynamicFilterFields = React.useMemo(
    () => applyFacets(filterFields, facets),
    [filterFields, facets],
  );

  const defaultColumnFilters = React.useMemo(() => {
    const { sort: _sort, ...filters } = search;
    return Object.entries(filters)
      .map(([id, value]) => ({ id, value }))
      .filter(({ value }) => {
        if (value === null || value === undefined) return false;
        if (Array.isArray(value) && value.length === 0) return false;
        return true;
      });
  }, [search]);

  const sort = (search.sort ?? manifest.defaults?.sort) as
    | { id: string; desc: boolean }
    | null
    | undefined;

  return (
    <DataTableInfinite<RemoteRow>
      columns={columns}
      data={flatData}
      filterFields={dynamicFilterFields}
      defaultColumnFilters={defaultColumnFilters}
      defaultColumnSorting={sort ? [sort] : undefined}
      defaultColumnVisibility={defaultColumnVisibility}
      // A count the server said it does not compute is left undefined rather
      // than rendered as a confident zero.
      totalRows={
        capabilities.totalRowCount ? lastPage?.meta?.totalRowCount : undefined
      }
      filterRows={
        capabilities.filterRowCount ? lastPage?.meta?.filterRowCount : undefined
      }
      totalRowsFetched={flatData.length}
      isFetching={isFetching}
      isLoading={isLoading}
      hasNextPage={hasNextPage}
      fetchNextPage={fetchNextPage}
      // Backwards paging is what live mode is built on. Without it the button
      // is not rendered at all, rather than rendered and inert.
      {...(capabilities.backwardPagination ? { fetchPreviousPage } : {})}
      refetch={refetch}
      getRowId={accessors.getRowId}
      {...(getRowClassName ? { getRowClassName } : {})}
      // When the server cannot facet, these fall through to the table's own
      // faceting over the rows already loaded.
      {...(capabilities.facets
        ? {
            getFacetedUniqueValues: getFacetedUniqueValues(facets),
            getFacetedMinMaxValues: getFacetedMinMaxValues(facets),
          }
        : {})}
      {...(chartData && chartSlot
        ? { chartSlot: chartSlot(chartData, manifest.chart) }
        : {})}
      {...(sheetSlot ? { sheetSlot: sheetSlot(sheetFields) } : {})}
      tableId={tableId}
      {...slots}
    />
  );
}

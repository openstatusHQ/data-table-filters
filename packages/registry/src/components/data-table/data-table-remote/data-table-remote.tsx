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
  getMetaPage,
  refreshDataTableQuery,
  type BaseChartSchema,
  type PaginationStrategy,
  type Transport,
} from "@dtf/registry/lib/data-table";
import { useNuqsAdapter } from "@dtf/registry/lib/store/adapters/nuqs";
import { schemaToNuqsParsers } from "@dtf/registry/lib/store/adapters/nuqs/parser-bridge";
import { useFilterState } from "@dtf/registry/lib/store/hooks/useFilterState";
import { DataTableStoreProvider } from "@dtf/registry/lib/store/provider/DataTableStoreProvider";
import { field } from "@dtf/registry/lib/store/schema";
import type { SchemaDefinition } from "@dtf/registry/lib/store/schema/types";
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
import {
  useInfiniteQuery,
  useQueryClient,
  type FetchPreviousPageOptions,
} from "@tanstack/react-query";
import * as React from "react";

/**
 * A data table that renders from an endpoint rather than from local code.
 *
 * Point it at a manifest URL and a list URL and it draws the columns, the
 * filters, the sheet and the counts — none of which it knows anything about at
 * build time. Row actions are not drawn yet: the manifest carries their
 * descriptors, and rendering them is left to the host.
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
  /**
   * Serializes filter state into a query string for the data endpoint.
   *
   * Optional: a serializer written ahead of time has to be built from a schema,
   * and a table pointed at an endpoint does not have one until the manifest
   * arrives. Left out, one is derived from the manifest — see
   * `createRemoteSearchParamsSerializer`.
   */
  searchParamsSerializer?: (search: Record<string, unknown>) => string;
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

/**
 * What a slot can be built from once the manifest has resolved.
 *
 * The host renders `DataTableRemote` before any of this exists, so a slot that
 * needs it — a command palette parsing against the filter schema, a live button
 * that pages backwards — is a function of this context rather than a node.
 */
export type RemoteSlotContext = {
  manifest: TableManifest;
  /** The URL-state schema derived from the manifest's columns. */
  filterSchema: SchemaDefinition;
  tableId: string;
  /** Reload the list from "now". See `refreshDataTableQuery`. */
  refresh: () => Promise<void>;
  /** Only when the endpoint declares `backwardPagination`. */
  fetchPreviousPage?: (options?: FetchPreviousPageOptions) => Promise<unknown>;
};

type RemoteSlot =
  | React.ReactNode
  | ((context: RemoteSlotContext) => React.ReactNode);

/** Host-supplied pieces the manifest cannot describe. */
export type RemoteSlots = {
  commandSlot?: RemoteSlot;
  toolbarActions?: RemoteSlot;
  footerSlot?: React.ReactNode;
  floatingBarSlot?: React.ReactNode;
  /**
   * Given the chart points and the manifest's chart config, when the endpoint
   * says it has a chart. Not rendered at all when it does not.
   */
  chartSlot?: (
    chartData: BaseChartSchema[],
    config: TableChartConfig | undefined,
  ) => React.ReactNode;
  sheetSlot?: (
    fields: SheetField<RemoteRow>[],
    context: RemoteSlotContext,
  ) => React.ReactNode;
  /** Per-row styling, which no manifest field describes. */
  getRowClassName?: Parameters<
    typeof DataTableInfinite<RemoteRow>
  >[0]["getRowClassName"];
};

/** `/api/logs/schema` → `/api/logs`; anything else is returned unchanged. */
export function defaultDataEndpoint(manifestEndpoint: string): string {
  return manifestEndpoint.replace(/\/schema\/?$/, "") || "/";
}

/** A value outside the schema: a page param the pagination strategy added. */
function serializeLoose(value: unknown): string | null {
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isNaN(time) ? null : String(time);
  }
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }
  return null;
}

/**
 * A search-params serializer for a schema that is only known at runtime.
 *
 * Schema keys go through the same parsers the URL state uses, so the endpoint
 * sees exactly what the address bar shows (`?latency=100-3000`,
 * `?sort=date.desc`). Keys outside the schema are the pagination strategy's —
 * `cursor`, `direction`, `offset`, `size` — and are written as plain values,
 * with a `Date` as epoch milliseconds. An allow-list serializer would drop them
 * and every page would be the first page.
 *
 * `null`, `undefined` and `[]` are omitted, which is what
 * `createDataTableQueryOptions` relies on to clear a key.
 */
export function createRemoteSearchParamsSerializer(
  schema: SchemaDefinition,
): (search: Record<string, unknown>) => string {
  const parsers = schemaToNuqsParsers(schema) as Record<
    string,
    { serialize?: (value: unknown) => string } | undefined
  >;

  return (search) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(search)) {
      if (value === null || value === undefined) continue;
      if (Array.isArray(value) && value.length === 0) continue;

      const parser = Object.hasOwn(parsers, key) ? parsers[key] : undefined;
      let serialized: string | null;
      try {
        serialized = parser?.serialize
          ? parser.serialize(value)
          : serializeLoose(value);
      } catch {
        // A value the parser cannot write is not a filter the endpoint could
        // have read either.
        continue;
      }
      if (serialized === null || serialized === "") continue;
      params.set(key, serialized);
    }
    const query = params.toString();
    return query ? `?${query}` : "";
  };
}

/**
 * State the table writes that is not a column filter: the sort, the row whose
 * detail is open, and live mode. They share the URL with the filters, so they
 * are part of the same schema, and they are left out wherever the filters are
 * read back as filters.
 */
const VIEW_STATE_KEYS = ["sort", "uuid", "live"] as const;

/** The filter state without the view state, as TanStack column filters. */
export function toColumnFilters(
  search: Record<string, unknown>,
): { id: string; value: unknown }[] {
  return Object.entries(search)
    .filter(([id]) => !(VIEW_STATE_KEYS as readonly string[]).includes(id))
    .map(([id, value]) => ({ id, value }))
    .filter(({ value }) => {
      if (value === null || value === undefined) return false;
      if (Array.isArray(value) && value.length === 0) return false;
      return true;
    });
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

  // Spliced in before the schema is created so `defaults` cannot disagree with
  // `definition` — the same ordering the builder needs.
  //
  // `uuid` is where a row click writes the detail row when the table has a
  // select column, and `live` is the live-mode toggle. Neither is a column, so
  // neither is in the manifest, and state written to a key the URL adapter has
  // no parser for is dropped: without them the sheet never opens and a live
  // button has nothing to flip. `live` is only declared when the endpoint can
  // page backwards, which is the only way live mode gets new rows.
  const backwardPagination = manifest.capabilities.backwardPagination;
  const filterSchema = React.useMemo(
    () =>
      generateFilterSchema(definition, {
        sort: field.sort(),
        uuid: field.string(),
        ...(backwardPagination ? { live: field.boolean().default(false) } : {}),
      }),
    [definition, backwardPagination],
  );

  const derivedSerializer = React.useMemo(
    () => createRemoteSearchParamsSerializer(filterSchema.definition),
    [filterSchema],
  );
  const serializer = searchParamsSerializer ?? derivedSerializer;

  const adapter = useNuqsAdapter(filterSchema.definition, { id: tableId });

  const queryOptions = React.useMemo(
    () =>
      createDataTableQueryOptions<RemoteRow[], unknown>({
        queryKeyPrefix: tableId,
        apiEndpoint: dataEndpoint ?? defaultDataEndpoint(manifestEndpoint),
        searchParamsSerializer: serializer,
        ...(transport ? { transport } : {}),
        ...(pagination ? { pagination } : {}),
      }),
    [
      tableId,
      dataEndpoint,
      manifestEndpoint,
      serializer,
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
        filterSchema={filterSchema.definition}
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
  filterSchema: SchemaDefinition;
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
  filterSchema,
  queryOptions,
  tableId,
  commandSlot,
  toolbarActions,
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
  } = useInfiniteQuery(queryOptions(search));

  const queryClient = useQueryClient();
  // Not the bare `refetch`: after live mode has prepended pages that restarts
  // from a "prev" cursor and wipes the list.
  const refresh = React.useCallback(
    () => refreshDataTableQuery(queryClient, queryOptions(search)),
    [queryClient, queryOptions, search],
  );

  const flatData = React.useMemo(
    () => data?.pages?.flatMap((page) => page.data ?? []) ?? [],
    [data?.pages],
  );

  // Not the last page: with `backwardPagination`, live mode prepends via
  // `fetchPreviousPage`, so the page carrying meta is not at a fixed index.
  // `getMetaPage` locates it from React Query's page params and falls back to
  // the last page when meta skipping is off.
  const metaPage = getMetaPage(data);
  const facets = capabilities.facets ? metaPage?.meta?.facets : undefined;
  const chartData = capabilities.chart ? metaPage?.meta?.chartData : undefined;

  const accessors = React.useMemo(
    () => createRowAccessors<RemoteRow>(manifest),
    [manifest],
  );

  const dynamicFilterFields = React.useMemo(
    () => applyFacets(filterFields, facets),
    [filterFields, facets],
  );

  const defaultColumnFilters = React.useMemo(
    () => toColumnFilters(search),
    [search],
  );

  const context = React.useMemo<RemoteSlotContext>(
    () => ({
      manifest,
      filterSchema,
      tableId,
      refresh,
      ...(capabilities.backwardPagination ? { fetchPreviousPage } : {}),
    }),
    [
      manifest,
      filterSchema,
      tableId,
      refresh,
      capabilities.backwardPagination,
      fetchPreviousPage,
    ],
  );
  const renderSlot = (slot: RemoteSlot | undefined) =>
    typeof slot === "function" ? slot(context) : slot;

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
      // Restores the open row from a shared link.
      defaultRowSelection={
        typeof search.uuid === "string" ? { [search.uuid]: true } : undefined
      }
      defaultColumnVisibility={defaultColumnVisibility}
      // A count the server said it does not compute is left undefined rather
      // than rendered as a confident zero.
      totalRows={
        capabilities.totalRowCount ? metaPage?.meta?.totalRowCount : undefined
      }
      filterRows={
        capabilities.filterRowCount ? metaPage?.meta?.filterRowCount : undefined
      }
      totalRowsFetched={flatData.length}
      isFetching={isFetching}
      isLoading={isLoading}
      hasNextPage={hasNextPage}
      fetchNextPage={fetchNextPage}
      // Backwards paging is what live mode is built on. Without it the button
      // is not rendered at all, rather than rendered and inert.
      {...(capabilities.backwardPagination ? { fetchPreviousPage } : {})}
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
      {...(sheetSlot ? { sheetSlot: sheetSlot(sheetFields, context) } : {})}
      {...(commandSlot ? { commandSlot: renderSlot(commandSlot) } : {})}
      {...(toolbarActions
        ? { toolbarActions: renderSlot(toolbarActions) }
        : {})}
      tableId={tableId}
      {...slots}
    />
  );
}

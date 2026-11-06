"use client";

import { Link } from "@/components/custom/link";
import { LiveButton } from "@/components/data-table/data-table-infinite/live-button";
import { Skeleton } from "@/components/data-table/data-table-infinite/skeleton";
import { SocialsFooter } from "@/components/data-table/data-table-infinite/socials-footer";
import {
  createActionsColumn,
  DataTableActionsBar,
  DataTableActionsProvider,
} from "@dtf/registry/components/data-table/data-table-actions";
import { TimelineChart } from "@dtf/registry/components/data-table/data-table-chart/timeline-chart";
import { DataTableFilterCommand } from "@dtf/registry/components/data-table/data-table-filter-command";
import { DataTableFloatingBar } from "@dtf/registry/components/data-table/data-table-floating-bar";
import { useDataTable } from "@dtf/registry/components/data-table/data-table-provider";
import { DataTableRefreshButton } from "@dtf/registry/components/data-table/data-table-refresh-button";
import {
  DataTableRemote,
  defaultDataEndpoint,
} from "@dtf/registry/components/data-table/data-table-remote";
import { MemoizedDataTableSheetContent } from "@dtf/registry/components/data-table/data-table-sheet/data-table-sheet-content";
import { DataTableSheetDetails } from "@dtf/registry/components/data-table/data-table-sheet/data-table-sheet-details";
import type { SheetField } from "@dtf/registry/components/data-table/types";
import { useTableManifest } from "@dtf/registry/hooks/use-table-manifest";
import {
  isContractValid,
  opaqueCursorPagination,
  timestampCursorPagination,
  timestampKeys,
  validateListResponse,
  type Transport,
} from "@dtf/registry/lib/data-table";
import { useFilterState } from "@dtf/registry/lib/store/hooks/useFilterState";
import {
  createRowAccessors,
  type TableManifest,
} from "@dtf/registry/lib/table-schema";
import * as React from "react";
import {
  EXAMPLES,
  headlessHref,
  tableIdFor,
  timeColumnKey,
  withoutQuery,
  type ManifestTarget,
} from "./endpoint";
import { EndpointBar } from "./endpoint-bar";
import { reviveListPayload } from "./parse-response";

type Row = Record<string, unknown>;

// Module constants: the table's column and visibility options must not change
// identity between renders. The menu column ships hidden, as on /drizzle, and
// is enabled from the view options; the bulk bar is what a selection shows.
const ACTION_COLUMNS = [createActionsColumn<Row>({ size: 37 })];
const ACTIONS_HIDDEN = { actions: false };

export function Client({
  input,
  target,
}: {
  input: string;
  target: ManifestTarget;
}) {
  if (!target.ok) {
    return (
      <EndpointProblem
        input={input}
        title="That URL cannot be loaded"
        detail={target.reason}
      />
    );
  }

  // Keyed so nothing from one endpoint — the manifest query, the last error,
  // the text in the field — is carried into the next.
  return (
    <RemoteClient
      key={target.url}
      input={input}
      url={target.url}
      externalHost={target.externalHost}
    />
  );
}

function RemoteClient({
  input,
  url,
  externalHost,
}: {
  input: string;
  url: string;
  externalHost: string | null;
}) {
  const query = useTableManifest(url);

  if (query.error) {
    return (
      <EndpointProblem
        input={input}
        title="The manifest could not be loaded"
        detail={query.error.message}
        hint={
          externalHost
            ? `The request is made from your browser, so ${externalHost} has to allow this origin with CORS headers.`
            : undefined
        }
      />
    );
  }
  if (!query.data) return <Skeleton />;

  return (
    <RemoteTable
      input={input}
      url={url}
      externalHost={externalHost}
      manifest={query.data}
    />
  );
}

/**
 * Everything below is the same for every endpoint. Nothing in it names a
 * column: what differs between two tables arrives in the manifest.
 */
function RemoteTable({
  input,
  url,
  externalHost,
  manifest,
}: {
  input: string;
  url: string;
  externalHost: string | null;
  manifest: TableManifest;
}) {
  const [listError, setListError] = React.useState<string | null>(null);
  // The manifest URL may carry a query string; the rows URL is built from its
  // path alone, and the table appends its own.
  const dataEndpoint = defaultDataEndpoint(withoutQuery(url));

  const timestampColumns = React.useMemo(
    () => timestampKeys(manifest.schema),
    [manifest.schema],
  );
  const parse = React.useCallback(
    async (response: Response) =>
      reviveListPayload(await response.json(), timestampColumns),
    [timestampColumns],
  );

  // Requests overlap — a filter change starts one while the last is still in
  // flight — and they settle in any order. Only the request started last may
  // set the message, or a slow failure would overwrite a newer success.
  const latestRequest = React.useRef(0);
  const requestOf = React.useRef(new WeakMap<Response, number>());

  // The table renders a failed rows request as an empty table, which reads as
  // "no results". The transport is where every way of failing passes through —
  // a non-2xx status, a body that cannot be read, and a body in the wrong
  // shape — so it reports them.
  const { capabilities } = manifest;
  const transport = React.useMemo<Transport<Row[], unknown>>(() => {
    const report = (request: number, message: string | null) => {
      if (request === latestRequest.current) setListError(message);
    };

    return {
      fetch: async (...args) => {
        const request = ++latestRequest.current;
        try {
          const response = await fetch(...args);
          requestOf.current.set(response, request);
          report(
            request,
            response.ok
              ? null
              : `The rows request failed with ${response.status} ${response.statusText}`.trim(),
          );
          return response;
        } catch (error) {
          if (!(error instanceof DOMException && error.name === "AbortError")) {
            report(request, "The rows request did not complete.");
          }
          throw error;
        }
      },
      parseResponse: async (response) => {
        const request =
          requestOf.current.get(response) ?? latestRequest.current;

        let payload: Awaited<ReturnType<typeof parse>>;
        try {
          payload = await parse(response);
        } catch (error) {
          report(request, "The rows response could not be read.");
          throw error;
        }

        // A 200 in the wrong shape — `{ rows: [] }`, `null` — would otherwise
        // render as an empty table with nothing to say why.
        const issues = validateListResponse(payload, { capabilities });
        if (!isContractValid(issues)) {
          const issue = issues.find((item) => item.severity === "error");
          const message = issue
            ? `The rows response does not match the list contract: ${issue.message}.`
            : "The rows response does not match the list contract.";
          report(request, message);
          throw new Error(message);
        }
        return payload;
      },
    };
  }, [parse, capabilities]);

  // Live mode pages backwards along a timestamp, so an endpoint that offers it
  // gets the timestamp cursor. Any other endpoint gets its own `nextCursor`
  // echoed back untouched, which covers an offset as well as an opaque token.
  const pagination = React.useMemo(
    () =>
      manifest.capabilities.backwardPagination
        ? timestampCursorPagination()
        : opaqueCursorPagination(),
    [manifest.capabilities.backwardPagination],
  );

  const liveColumn = timeColumnKey(manifest);
  const tableId = tableIdFor(url);

  // Actions POST row ids to a URL the manifest chose, and a root-relative one
  // resolves against this site. A manifest from another host could therefore
  // name this site's own action routes over its own rows, so actions are only
  // drawn for an endpoint this site serves.
  const actions =
    externalHost === null && manifest.capabilities.actions
      ? manifest.actions
      : undefined;
  const hasActions = Boolean(actions?.length);

  const accessors = React.useMemo(
    () => createRowAccessors<Row>(manifest),
    [manifest],
  );

  const table = (
    <DataTableRemote
      manifestEndpoint={url}
      dataEndpoint={dataEndpoint}
      initialManifest={manifest}
      transport={transport}
      pagination={pagination}
      tableId={tableId}
      {...(hasActions
        ? {
            extraColumns: ACTION_COLUMNS,
            defaultColumnVisibility: ACTIONS_HIDDEN,
            floatingBarSlot: (
              <DataTableFloatingBar<Row>>
                {({ rows }) => <DataTableActionsBar rows={rows} />}
              </DataTableFloatingBar>
            ),
          }
        : {})}
      commandSlot={({ filterSchema, tableId }) => (
        <>
          <EndpointBar
            header
            input={input}
            externalHost={externalHost}
            listError={listError}
            inspection={{ manifest, dataEndpoint, parse }}
          />
          <DataTableFilterCommand schema={filterSchema} tableId={tableId} />
        </>
      )}
      toolbarActions={({ refresh, fetchPreviousPage }) => [
        <DataTableRefreshButton key="refresh" onClick={refresh} />,
        fetchPreviousPage && liveColumn ? (
          <LiveButton
            key="live"
            fetchPreviousPage={fetchPreviousPage}
            columnId={liveColumn}
          />
        ) : null,
      ]}
      chartSlot={(data, config) =>
        config ? (
          <TimelineChart
            data={data}
            className="-mb-2"
            columnId={config.columnKey}
            series={config.series}
          />
        ) : null
      }
      sheetSlot={(fields) => (
        <RemoteSheet fields={fields} manifest={manifest} />
      )}
      footerSlot={
        <SocialsFooter
          showConfigurationDropdown={false}
          prefetchEnabled={false}
          adapterType="nuqs"
        />
      }
    />
  );

  if (!hasActions) return table;

  return (
    <DataTableActionsProvider<Row>
      actions={actions}
      getRowId={accessors.getRowId}
      {...(accessors.getRowLabel ? { getRowLabel: accessors.getRowLabel } : {})}
      // The table's own query key prefix: every page under it is refetched
      // once an action has landed.
      queryKeyPrefix={tableId}
    >
      {table}
    </DataTableActionsProvider>
  );
}

function RemoteSheet({
  fields,
  manifest,
}: {
  fields: SheetField<Row>[];
  manifest: TableManifest;
}) {
  const { table, rowSelection, isLoading, filterFields } = useDataTable<
    Row,
    unknown
  >();
  // With a select column a row click writes the detail row to `uuid` and
  // `rowSelection` is the checkbox set; without one, the selection is the row.
  const uuid = useFilterState((state) => state.uuid) as
    | string
    | null
    | undefined;
  const isMultiSelect = !!table.options.enableMultiRowSelection;
  const selectedRowKey = isMultiSelect
    ? (uuid ?? undefined)
    : Object.keys(rowSelection)?.[0];
  const selectedRow = React.useMemo(() => {
    if (isLoading && !selectedRowKey) return undefined;
    return table
      .getCoreRowModel()
      .flatRows.find((row) => row.id === selectedRowKey);
  }, [selectedRowKey, isLoading, table]);

  const accessors = React.useMemo(
    () => createRowAccessors<Row>(manifest),
    [manifest],
  );
  const title = selectedRow
    ? (accessors.getRowLabel?.(selectedRow.original) ??
      accessors.getRowId(selectedRow.original))
    : undefined;

  return (
    <DataTableSheetDetails title={title} titleClassName="font-mono">
      <MemoizedDataTableSheetContent
        table={table}
        data={selectedRow?.original}
        filterFields={filterFields}
        fields={fields}
      />
    </DataTableSheetDetails>
  );
}

function EndpointProblem({
  input,
  title,
  detail,
  hint,
}: {
  input: string;
  title: string;
  detail: string;
  hint?: string;
}) {
  return (
    <main
      id="content"
      className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center gap-6 p-4 sm:p-6"
    >
      <div className="flex flex-col gap-2">
        <h1 className="text-foreground text-xl font-semibold">{title}</h1>
        <p className="text-muted-foreground font-mono text-sm break-words">
          {detail}
        </p>
        {hint ? <p className="text-muted-foreground text-sm">{hint}</p> : null}
      </div>
      <EndpointBar input={input} />
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Endpoints on this site</p>
        <ul className="text-muted-foreground flex flex-col gap-1.5 text-sm">
          {EXAMPLES.map((example) => (
            <li key={example.manifest}>
              <Link href={headlessHref(example.manifest)}>{example.label}</Link>
              {": "}
              {example.description}
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground text-sm">
          A manifest is a JSON description of a table that an endpoint serves
          about itself. <Link href="/docs/headless">Read how to serve one</Link>
          .
        </p>
      </div>
    </main>
  );
}

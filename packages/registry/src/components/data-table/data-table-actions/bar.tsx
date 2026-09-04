"use client";

import { DataTableContext } from "@dtf/registry/components/data-table/data-table-provider";
import { Button } from "@dtf/registry/components/ui/button";
import * as React from "react";
import { useDataTableActions } from "./provider";
import { actionsForScope, partitionRows } from "./utils";

/**
 * Bulk buttons for a selection. Drop it into `DataTableFloatingBar`:
 *
 * ```tsx
 * <DataTableFloatingBar>
 *   {({ rows }) => <DataTableActionsBar rows={rows} />}
 * </DataTableFloatingBar>
 * ```
 *
 * Structurally typed on `{ original }` so it accepts TanStack rows without
 * depending on the table.
 */
export function DataTableActionsBar<TData>({
  rows,
}: {
  rows: readonly { original: TData }[];
}) {
  const { actions, getRowId, getRowActions, trigger, isPending } =
    useDataTableActions<TData>();
  // Optional on purpose: inside `DataTableFloatingBar` the table is there and
  // the selection is cleared once the action landed — the rows it named may
  // have left the view, and a bar saying "3 selected" over nothing is wrong.
  const table = React.useContext(DataTableContext)?.table;
  const bulk = actionsForScope(actions, "bulk");
  if (bulk.length === 0) return null;

  return (
    <>
      {bulk.map((action) => {
        const { eligible, skipped } = partitionRows(
          rows,
          action.id,
          getRowActions,
        );
        // The server publishes its `maxIds`; past it the request is refused
        // as `invalid_request`, so refuse it here with a reason instead.
        const overLimit =
          action.maxIds !== undefined && eligible.length > action.maxIds;
        // Why the button is dead, in the order the user hits them. A disabled
        // button swallows pointer events, so the tooltip lives on the wrapper
        // — on the button it would never show.
        const reason = overLimit
          ? `${action.label} applies to at most ${action.maxIds?.toLocaleString()} rows at a time`
          : eligible.length === 0
            ? `Select a row this action applies to`
            : isPending
              ? "Another action is still running"
              : undefined;
        return (
          <span
            key={action.id}
            className="inline-flex"
            title={reason}
            data-reason={reason}
          >
            <Button
              size="sm"
              variant={
                action.variant === "destructive" ? "destructive" : "outline"
              }
              disabled={reason !== undefined}
              data-action={action.id}
              data-eligible={eligible.length}
              data-skipped={skipped}
              data-over-limit={overLimit ? "" : undefined}
              onClick={() =>
                trigger(
                  action,
                  {
                    scope: "ids",
                    ids: eligible.map((row) => getRowId(row.original)),
                  },
                  {
                    count: eligible.length,
                    skipped,
                    onApplied: () => table?.resetRowSelection(),
                  },
                )
              }
            >
              {action.label}
              <span className="tabular-nums opacity-70">{eligible.length}</span>
            </Button>
          </span>
        );
      })}
    </>
  );
}

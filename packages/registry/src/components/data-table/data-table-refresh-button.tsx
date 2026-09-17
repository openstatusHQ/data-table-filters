"use client";

import { useDataTable } from "@dtf/registry/components/data-table/data-table-provider";
import { Button } from "@dtf/registry/components/ui/button";
import { LoaderCircle, RefreshCcw } from "lucide-react";

/**
 * A toolbar action that re-reads the table from the top. Pair it with
 * `refreshDataTableQuery` rather than the bare `refetch`: the helper resets
 * the cache to a fresh first page first, so a list extended by live mode or
 * infinite scroll does not restart from a stale cursor.
 *
 * @example
 * ```tsx
 * const queryClient = useQueryClient();
 * const refresh = () => refreshDataTableQuery(queryClient, dataOptions(search));
 * <DataTableInfinite toolbarActions={<DataTableRefreshButton onClick={refresh} />} />
 * ```
 */
export function DataTableRefreshButton({ onClick }: { onClick: () => void }) {
  const { isLoading } = useDataTable();

  return (
    <Button
      variant="outline"
      size="icon"
      disabled={isLoading}
      onClick={onClick}
      className="shadow-none"
    >
      {isLoading ? (
        <LoaderCircle className="h-4 w-4 animate-spin" />
      ) : (
        <RefreshCcw className="h-4 w-4" />
      )}
      <span className="sr-only">Refresh data</span>
    </Button>
  );
}

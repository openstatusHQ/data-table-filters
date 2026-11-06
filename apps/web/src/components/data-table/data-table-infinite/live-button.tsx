"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDataTable } from "@dtf/registry/components/data-table/data-table-provider";
import { useHotKey } from "@dtf/registry/hooks/use-hot-key";
import { useFilterActions } from "@dtf/registry/lib/store/hooks/useFilterActions";
import { useFilterState } from "@dtf/registry/lib/store/hooks/useFilterState";
import type { FetchPreviousPageOptions } from "@tanstack/react-query";
import { CirclePause, CirclePlay } from "lucide-react";
import * as React from "react";

const REFRESH_INTERVAL = 5_000;

interface LiveButtonProps {
  fetchPreviousPage?: (
    options?: FetchPreviousPageOptions | undefined,
  ) => Promise<unknown>;
  /**
   * The timestamp column live mode runs along. Turning live mode on clears its
   * filter, and filtering on it turns live mode off.
   */
  columnId?: string;
}

// The button only touches `live`, `sort` and one timestamp column, whichever
// table it sits in — so the state is read loosely rather than against one
// table's schema.
type LiveState = Record<string, unknown>;

export function LiveButton({
  fetchPreviousPage,
  columnId = "date",
}: LiveButtonProps) {
  const live = useFilterState<LiveState, boolean>((s) => s.live === true);
  const date = useFilterState<LiveState, unknown>((s) => s[columnId]);
  const sort = useFilterState<LiveState, unknown>((s) => s.sort);
  const { setFilters } = useFilterActions<LiveState>();
  const { table } = useDataTable();
  useHotKey(handleClick, "j");

  React.useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    async function fetchData() {
      if (live) {
        await fetchPreviousPage?.();
        timeoutId = setTimeout(fetchData, REFRESH_INTERVAL);
      } else {
        clearTimeout(timeoutId);
      }
    }

    fetchData();

    return () => {
      clearTimeout(timeoutId);
    };
  }, [live, fetchPreviousPage]);

  // REMINDER: make sure to reset live when date is set
  // NOTE: live is intentionally NOT in deps - we only want to reset live when date/sort changes,
  // not when live itself changes (which would cause immediate reset on toggle)
  React.useEffect(() => {
    const hasDate = Array.isArray(date) && date.length > 0;
    const reset = (hasDate || sort) && live;
    if (reset) {
      setFilters({ live: undefined });
    }
  }, [date, sort, live, setFilters]);

  function handleClick() {
    setFilters({
      live: !live,
      [columnId]: undefined,
      sort: undefined,
    });
    table.getColumn(columnId)?.setFilterValue(undefined);
    table.resetSorting();
  }

  return (
    <Button
      className={cn(
        "shadow-none",
        live && "border-info text-info hover:text-info",
      )}
      onClick={handleClick}
      variant="outline"
    >
      {live ? (
        <CirclePause className="mr-2 h-4 w-4" />
      ) : (
        <CirclePlay className="mr-2 h-4 w-4" />
      )}
      Live
    </Button>
  );
}

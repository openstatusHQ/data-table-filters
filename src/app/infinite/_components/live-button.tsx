"use client";

import { useDataTable } from "@/components/data-table/data-table-provider";
import { Button } from "@/components/ui/button";
import { useHotKey } from "@/hooks/use-hot-key";
import { useFilterActions, useFilterState } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { FetchPreviousPageOptions } from "@tanstack/react-query";
import { CirclePause, CirclePlay } from "lucide-react";
import * as React from "react";
import type { FilterState } from "../schema";

const REFRESH_INTERVAL = 5_000;

interface LiveButtonProps {
  fetchPreviousPage?: (
    options?: FetchPreviousPageOptions | undefined,
  ) => Promise<unknown>;
}

export function LiveButton({ fetchPreviousPage }: LiveButtonProps) {
  const live = useFilterState<FilterState, FilterState["live"]>((s) => s.live);
  const date = useFilterState<FilterState, FilterState["date"]>((s) => s.date);
  const sort = useFilterState<FilterState, FilterState["sort"]>((s) => s.sort);
  const { setFilters } = useFilterActions<FilterState>();
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
    const reset = ((date?.length && date.length > 0) || sort) && live;
    if (reset) {
      setFilters({ live: undefined });
    }
  }, [date, sort, live, setFilters]);

  function handleClick() {
    setFilters({
      live: !live,
      date: undefined,
      sort: undefined,
    });
    table.getColumn("date")?.setFilterValue(undefined);
    table.resetSorting();
  }

  return (
    <Button
      className={cn(live && "border-info text-info hover:text-info")}
      onClick={handleClick}
      variant="outline"
      size="sm"
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

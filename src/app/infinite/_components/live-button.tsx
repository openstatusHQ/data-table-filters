"use client";

import * as React from "react";
import { FetchPreviousPageOptions } from "@tanstack/react-query";
import { useQueryStates } from "nuqs";
import { searchParamsParser } from "../search-params";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CirclePlay, CirclePause } from "lucide-react";
import { useDataTable } from "@/providers/data-table";
import { useHotKey } from "@/hooks/use-hot-key";

interface LiveButtonProps {
  fetchPreviousPage?: (options?: FetchPreviousPageOptions | undefined) => void;
}

export function LiveButton({ fetchPreviousPage }: LiveButtonProps) {
  const [{ live, date, sort }, setSearch] = useQueryStates(searchParamsParser);
  const { table } = useDataTable();
  useHotKey(handleClick, "j");

  React.useEffect(() => {
    const interval = setInterval(() => {
      if (live) {
        fetchPreviousPage?.();
      }
    }, 4_000);
    return () => clearInterval(interval);
  }, [live, fetchPreviousPage]);

  // REMINDER: make sure to reset live when date is set
  // TODO: test properly
  React.useEffect(() => {
    if ((date || sort) && live) {
      setSearch((prev) => ({ ...prev, live: null }));
    }
  }, [date, sort]);

  function handleClick() {
    setSearch((prev) => ({
      ...prev,
      live: !prev.live,
      date: null,
      sort: null,
    }));
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

"use client";

import React from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { dataOptions } from "../query-options";
import { useQueryStates } from "nuqs";
import { searchParamsParser } from "@/_data-table/search-params";
import { LoaderCircle } from "lucide-react";

const BOTTOM_REACHED_THRESHOLD = 10;

// SIMPLE EXAMPLE OF A TABLE WITH INFINITE SCROLL

export function InfiniteTable() {
  const [search] = useQueryStates(searchParamsParser);
  const tableContainerRef = React.useRef<HTMLDivElement>(null);
  const { data, isFetching, isLoading, fetchNextPage } = useInfiniteQuery(
    dataOptions({})
  );

  const flatData = React.useMemo(
    () => data?.pages?.flatMap((page) => page.data ?? []) ?? [],
    [data]
  );

  const totalDBRowCount = data?.pages?.[0]?.meta?.totalRowCount ?? 0;
  const totalFetched = flatData?.length ?? 0;

  const fetchMoreOnBottomReached = React.useCallback(
    (ref?: HTMLDivElement | null) => {
      if (ref) {
        const { scrollHeight, scrollTop, clientHeight } = ref;
        console.log({ scrollHeight, scrollTop, clientHeight });
        if (
          scrollHeight - scrollTop - clientHeight < BOTTOM_REACHED_THRESHOLD &&
          !isFetching &&
          totalFetched < totalDBRowCount
        ) {
          fetchNextPage();
        }
      }
    },
    [fetchNextPage, isFetching, totalDBRowCount, totalFetched]
  );

  React.useEffect(() => {
    fetchMoreOnBottomReached(tableContainerRef.current);
  }, [fetchMoreOnBottomReached]);

  if (isLoading) return "Loading...";

  return (
    <div>
      <div
        ref={tableContainerRef}
        onScroll={(e) => fetchMoreOnBottomReached(e.target as HTMLDivElement)}
        style={{
          overflowY: "auto", // our scrollable table container
          position: "relative", // needed for sticky header
          height: "200px", // should be a fixed height
        }}
      >
        {flatData?.map((row, i) => (
          <div key={i}>{row.name}</div>
        ))}
      </div>
      {isFetching ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
    </div>
  );
}

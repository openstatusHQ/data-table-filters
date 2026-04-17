import { useFilterState } from "@dtf/registry/lib/store/hooks/useFilterState";
import * as React from "react";

// TODO: make a BaseObject (incl. date and uuid e.g. for every upcoming branch of infinite table)
// NOTE: Must be called inside DataTableStoreProvider context
export function useLiveMode<TData extends { date: Date }>(data: TData[]) {
  const live = useFilterState<{ live: boolean }, boolean>((s) => s.live);
  // REMINDER: used to capture the live mode on timestamp
  const liveTimestamp = React.useRef<number | undefined>(
    live ? new Date().getTime() : undefined,
  );

  React.useEffect(() => {
    if (live) liveTimestamp.current = new Date().getTime();
    else liveTimestamp.current = undefined;
  }, [live]);

  const anchorRow = React.useMemo(() => {
    if (!live) return undefined;

    // eslint-disable-next-line react-hooks/refs
    const item = data.find((item) => {
      // return first item that is there if not liveTimestamp
      if (!liveTimestamp.current) return true;
      // return first item that is after the liveTimestamp
      if (item.date.getTime() > liveTimestamp.current) return false;
      return true;
      // return first item if no liveTimestamp
    });

    return item;
  }, [live, data]);

  // eslint-disable-next-line react-hooks/refs
  return { row: anchorRow, timestamp: liveTimestamp.current };
}

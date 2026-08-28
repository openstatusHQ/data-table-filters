import { useFilterState } from "@dtf/registry/lib/store/hooks/useFilterState";
import * as React from "react";

// TODO: make a BaseObject (incl. date and uuid e.g. for every upcoming branch of infinite table)
// NOTE: Must be called inside DataTableStoreProvider context
export function useLiveMode<TData extends { date: Date }>(data: TData[]) {
  const live = useFilterState<{ live: boolean }, boolean>((s) => s.live);
  /**
   * REMINDER: the captured timestamp is state, not a ref.
   *
   * It is read during render — `getRowClassName` dims every row older than it —
   * so writing it from an effect left the render that reacted to the toggle
   * still looking at the previous value, and nothing re-rendered afterwards.
   * Switching live mode *off* triggers no refetch of its own (`live` is not part
   * of the query key), so the rows stayed dimmed until an unrelated fetch
   * rebuilt them. As state, the write schedules the render that clears them.
   */
  const [timestamp, setTimestamp] = React.useState<number | undefined>(() =>
    live ? new Date().getTime() : undefined,
  );

  React.useEffect(() => {
    setTimestamp(live ? new Date().getTime() : undefined);
  }, [live]);

  const anchorRow = React.useMemo(() => {
    if (!live) return undefined;

    const item = data.find((item) => {
      // return first item that is there if not timestamp
      if (!timestamp) return true;
      // return first item that is after the timestamp
      if (item.date.getTime() > timestamp) return false;
      return true;
      // return first item if no timestamp
    });

    return item;
  }, [live, data, timestamp]);

  return { row: anchorRow, timestamp };
}

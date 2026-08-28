import { useFilterState } from "@dtf/registry/lib/store/hooks/useFilterState";
import * as React from "react";

// TODO: make a BaseObject (incl. date and uuid e.g. for every upcoming branch of infinite table)
// NOTE: Must be called inside DataTableStoreProvider context
export function useLiveMode<TData extends { date: Date }>(data: TData[]) {
  const live = useFilterState<{ live: boolean }, boolean>((s) => s.live);
  /**
   * REMINDER: the captured timestamp is state adjusted during render, not a ref
   * and not an effect.
   *
   * It is read during render — `getRowClassName` dims every row older than it —
   * so a ref written from an effect left the render that reacted to the toggle
   * still looking at the previous value, with nothing to re-render afterwards:
   * switching live mode *off* triggers no refetch of its own (`live` is not part
   * of the query key), so the rows stayed dimmed until an unrelated fetch
   * rebuilt them. An effect would fix that but only after the browser had
   * painted the stale frame. Comparing the previous value during render lets
   * React re-run this component before committing, so the rows are never
   * painted with a timestamp that belongs to the other mode.
   * https://react.dev/reference/react/useState#storing-information-from-previous-renders
   */
  const [timestamp, setTimestamp] = React.useState<number | undefined>(() =>
    live ? new Date().getTime() : undefined,
  );
  const [prevLive, setPrevLive] = React.useState(live);

  if (prevLive !== live) {
    setPrevLive(live);
    setTimestamp(live ? new Date().getTime() : undefined);
  }

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

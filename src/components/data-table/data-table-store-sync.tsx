"use client";

/**
 * DataTableStoreSync - Syncs React Table state to BYOS adapter (ONE-WAY)
 *
 * This component syncs changes from React Table's state (columnFilters, sorting,
 * rowSelection) to the BYOS adapter. Filter components update the table directly
 * via column.setFilterValue(), and this component propagates those changes
 * to the BYOS adapter for URL sync (nuqs) or state persistence (Zustand).
 *
 * IMPORTANT: This sync is ONE-WAY (Table → BYOS). We use refs to track what
 * we've sent to avoid depending on BYOS state, which would cause infinite loops.
 */
import { isStateEqual, useFilterActions, useStoreContext } from "@/lib/store";
import { useEffect, useRef } from "react";
import { useDataTable } from "./data-table-provider";

export function DataTableStoreSync() {
  useDataTableStoreSync();
  return null;
}

/**
 * Hook version for more control - syncs filters, sorting, and selection
 */
export function useDataTableStoreSync() {
  const context = useStoreContext();
  const { table, filterFields, sorting, rowSelection } = useDataTable();
  const { setFilters } = useFilterActions();

  const lastSentFiltersRef = useRef<Record<string, unknown>>({});
  const lastSentSortRef = useRef<{ id: string; desc: boolean } | null>(null);
  const lastSentUuidRef = useRef<string>("");
  const isInitialMount = useRef(true);

  const columnFilters = table.getState().columnFilters;

  // Sync column filters
  useEffect(() => {
    if (!context) return;
    if (isInitialMount.current) {
      isInitialMount.current = false;
      const filterFieldKeys = new Set(
        filterFields?.map((f) => f.value as string) || [],
      );
      const currentFilters: Record<string, unknown> = {};
      for (const filter of columnFilters) {
        if (filterFieldKeys.has(filter.id)) {
          currentFilters[filter.id] = filter.value;
        }
      }
      lastSentFiltersRef.current = { ...currentFilters };
      lastSentSortRef.current = sorting?.[0] || null;
      const selectedKeys = Object.keys(rowSelection || {});
      lastSentUuidRef.current = selectedKeys.length > 0 ? selectedKeys[0] : "";
      return;
    }

    const filterFieldKeys = new Set(
      filterFields?.map((f) => f.value as string) || [],
    );

    const currentFilters: Record<string, unknown> = {};
    for (const filter of columnFilters) {
      if (filterFieldKeys.has(filter.id)) {
        currentFilters[filter.id] = filter.value;
      }
    }

    if (isStateEqual(currentFilters, lastSentFiltersRef.current)) {
      return;
    }

    const updates: Record<string, unknown> = { ...currentFilters };

    for (const key of Object.keys(lastSentFiltersRef.current)) {
      if (!(key in currentFilters)) {
        updates[key] = null;
      }
    }

    for (const key of filterFieldKeys) {
      if (!(key in currentFilters)) {
        updates[key] = null;
      }
    }

    lastSentFiltersRef.current = { ...currentFilters };
    setFilters(updates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnFilters, context, filterFields, setFilters]);

  // Sync sorting
  useEffect(() => {
    if (!context) return;
    if (isInitialMount.current) return;

    const newSort = sorting?.[0] || null;
    const lastSort = lastSentSortRef.current;

    if (newSort?.id === lastSort?.id && newSort?.desc === lastSort?.desc) {
      return;
    }

    lastSentSortRef.current = newSort;
    setFilters({ sort: newSort });
  }, [sorting, context, setFilters]);

  // Sync row selection
  useEffect(() => {
    if (!context) return;
    if (isInitialMount.current) return;

    const selectedKeys = Object.keys(rowSelection || {});
    const newUuid = selectedKeys.length > 0 ? selectedKeys[0] : null;
    const newUuidStr = newUuid || "";

    if (newUuidStr === lastSentUuidRef.current) {
      return;
    }

    lastSentUuidRef.current = newUuidStr;
    setFilters({ uuid: newUuid });
  }, [rowSelection, context, setFilters]);
}

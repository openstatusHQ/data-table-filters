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
import { useFilterActions, useStoreContext } from "@/lib/store";
import { useEffect, useRef } from "react";
import { useDataTable } from "./data-table-provider";

export function DataTableStoreSync() {
  const context = useStoreContext();
  const { table, filterFields, sorting, rowSelection } = useDataTable();
  const { setFilters } = useFilterActions();

  // Track what we've sent to avoid re-sending the same values
  const lastSentFiltersRef = useRef<string>("");
  const lastSentSortRef = useRef<string>("");
  const lastSentUuidRef = useRef<string>("");
  const isInitialMount = useRef(true);

  // Get current state from table
  const columnFilters = table.getState().columnFilters;

  // Sync column filters (Table → URL)
  useEffect(() => {
    if (!context) return;
    if (isInitialMount.current) {
      // On initial mount, just capture current state without syncing
      isInitialMount.current = false;

      // Initialize refs with current state
      const filterFieldKeys = new Set(
        filterFields?.map((f) => f.value as string) || [],
      );
      const currentFilters: Record<string, unknown> = {};
      for (const filter of columnFilters) {
        if (filterFieldKeys.has(filter.id)) {
          currentFilters[filter.id] = filter.value;
        }
      }
      lastSentFiltersRef.current = JSON.stringify(currentFilters);
      lastSentSortRef.current = JSON.stringify(sorting?.[0] || null);
      const selectedKeys = Object.keys(rowSelection || {});
      lastSentUuidRef.current = selectedKeys.length > 0 ? selectedKeys[0] : "";
      return;
    }

    const filterFieldKeys = new Set(
      filterFields?.map((f) => f.value as string) || [],
    );

    // Build current filter state
    const currentFilters: Record<string, unknown> = {};
    for (const filter of columnFilters) {
      if (filterFieldKeys.has(filter.id)) {
        currentFilters[filter.id] = filter.value;
      }
    }

    // Check if filters have actually changed from what we last sent
    const currentFiltersJson = JSON.stringify(currentFilters);
    if (currentFiltersJson === lastSentFiltersRef.current) {
      return; // No change, skip
    }

    // Calculate what needs to be updated (including nulls for removed filters)
    const updates: Record<string, unknown> = { ...currentFilters };

    // Check for removed filters (keys that were in last sent but not in current)
    try {
      const lastSent = JSON.parse(lastSentFiltersRef.current || "{}");
      for (const key of Object.keys(lastSent)) {
        if (!(key in currentFilters)) {
          updates[key] = null;
        }
      }
    } catch {
      // Ignore parse errors
    }

    // Also check filterFieldKeys for nulls (filter was cleared)
    for (const key of filterFieldKeys) {
      if (!(key in currentFilters)) {
        updates[key] = null;
      }
    }

    // Update ref BEFORE calling setFilters to prevent re-entry
    lastSentFiltersRef.current = currentFiltersJson;

    // Send updates
    setFilters(updates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnFilters, context, filterFields, setFilters]);

  // Sync sorting (Table → URL)
  useEffect(() => {
    if (!context) return;
    if (isInitialMount.current) return; // Skip initial mount (handled above)

    const newSort = sorting?.[0] || null;
    const newSortJson = JSON.stringify(newSort);

    if (newSortJson === lastSentSortRef.current) {
      return; // No change, skip
    }

    lastSentSortRef.current = newSortJson;
    setFilters({ sort: newSort });
  }, [sorting, context, setFilters]);

  // Sync row selection/uuid (Table → URL)
  useEffect(() => {
    if (!context) return;
    if (isInitialMount.current) return; // Skip initial mount (handled above)

    const selectedKeys = Object.keys(rowSelection || {});
    const newUuid = selectedKeys.length > 0 ? selectedKeys[0] : null;
    const newUuidStr = newUuid || "";

    if (newUuidStr === lastSentUuidRef.current) {
      return; // No change, skip
    }

    lastSentUuidRef.current = newUuidStr;
    setFilters({ uuid: newUuid });
  }, [rowSelection, context, setFilters]);

  return null;
}

/**
 * Hook version for more control - syncs filters, sorting, and selection
 */
export function useDataTableStoreSync() {
  const context = useStoreContext();
  const { table, filterFields, sorting, rowSelection } = useDataTable();
  const { setFilters } = useFilterActions();

  const lastSentFiltersRef = useRef<string>("");
  const lastSentSortRef = useRef<string>("");
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
      lastSentFiltersRef.current = JSON.stringify(currentFilters);
      lastSentSortRef.current = JSON.stringify(sorting?.[0] || null);
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

    const currentFiltersJson = JSON.stringify(currentFilters);
    if (currentFiltersJson === lastSentFiltersRef.current) {
      return;
    }

    const updates: Record<string, unknown> = { ...currentFilters };

    try {
      const lastSent = JSON.parse(lastSentFiltersRef.current || "{}");
      for (const key of Object.keys(lastSent)) {
        if (!(key in currentFilters)) {
          updates[key] = null;
        }
      }
    } catch {
      // Ignore parse errors
    }

    for (const key of filterFieldKeys) {
      if (!(key in currentFilters)) {
        updates[key] = null;
      }
    }

    lastSentFiltersRef.current = currentFiltersJson;
    setFilters(updates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnFilters, context, filterFields, setFilters]);

  // Sync sorting
  useEffect(() => {
    if (!context) return;
    if (isInitialMount.current) return;

    const newSort = sorting?.[0] || null;
    const newSortJson = JSON.stringify(newSort);

    if (newSortJson === lastSentSortRef.current) {
      return;
    }

    lastSentSortRef.current = newSortJson;
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

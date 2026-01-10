"use client";

/**
 * DataTableStoreSync - Syncs React Table state to BYOS adapter
 *
 * This component syncs changes from React Table's state (columnFilters, sorting,
 * rowSelection) to the BYOS adapter. Filter components update the table directly
 * via column.setFilterValue(), and this component propagates those changes
 * to the BYOS adapter for URL sync (nuqs) or state persistence (Zustand).
 */
import { StoreContext, useFilterActions, useFilterState } from "@/lib/store";
import { useContext, useEffect, useRef } from "react";
import { useDataTable } from "./data-table-provider";

export function DataTableStoreSync() {
  const context = useContext(StoreContext);
  const { table, filterFields, sorting, rowSelection } = useDataTable();
  const { setFilters } = useFilterActions();
  const filterState = useFilterState<Record<string, unknown>>();
  const isInitialMount = useRef(true);
  const isSyncingRef = useRef(false);

  // Get current state from table
  const columnFilters = table.getState().columnFilters;

  // Sync column filters
  useEffect(() => {
    if (!context) return;
    if (isSyncingRef.current) return;
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const updates: Record<string, unknown> = {};
    const filterFieldKeys = new Set(
      filterFields?.map((f) => f.value as string) || [],
    );

    let hasChanges = false;

    for (const filter of columnFilters) {
      if (filterFieldKeys.has(filter.id)) {
        const currentValue = filterState[filter.id];
        if (!isEqual(currentValue, filter.value)) {
          updates[filter.id] = filter.value;
          hasChanges = true;
        }
      }
    }

    for (const key of filterFieldKeys) {
      const hasFilter = columnFilters.some((f) => f.id === key);
      if (!hasFilter) {
        const currentValue = filterState[key];
        if (currentValue !== null && currentValue !== undefined) {
          updates[key] = null;
          hasChanges = true;
        }
      }
    }

    if (hasChanges) {
      isSyncingRef.current = true;
      setFilters(updates);
      queueMicrotask(() => {
        isSyncingRef.current = false;
      });
    }
  }, [columnFilters, context, filterFields, filterState, setFilters]);

  // Sync sorting
  useEffect(() => {
    if (!context) return;
    if (isSyncingRef.current) return;

    const currentSort = filterState.sort as
      | { id: string; desc: boolean }
      | null
      | undefined;
    const newSort = sorting?.[0] || null;

    if (!isEqual(currentSort, newSort)) {
      isSyncingRef.current = true;
      setFilters({ sort: newSort });
      queueMicrotask(() => {
        isSyncingRef.current = false;
      });
    }
  }, [sorting, context, filterState.sort, setFilters]);

  // Sync row selection (uuid)
  useEffect(() => {
    if (!context) return;
    if (isSyncingRef.current) return;

    const currentUuid = filterState.uuid as string | null | undefined;
    const selectedKeys = Object.keys(rowSelection || {});
    const newUuid = selectedKeys.length > 0 ? selectedKeys[0] : null;

    if (currentUuid !== newUuid) {
      isSyncingRef.current = true;
      setFilters({ uuid: newUuid });
      queueMicrotask(() => {
        isSyncingRef.current = false;
      });
    }
  }, [rowSelection, context, filterState.uuid, setFilters]);

  return null;
}

/**
 * Simple equality check for filter values
 */
function isEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;

  // Array comparison
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((val, idx) => isEqual(val, b[idx]));
  }

  // Object comparison (shallow)
  if (typeof a === "object" && typeof b === "object") {
    const aKeys = Object.keys(a as object);
    const bKeys = Object.keys(b as object);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((key) =>
      isEqual(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key],
      ),
    );
  }

  return false;
}

/**
 * Hook version for more control - syncs filters, sorting, and selection
 */
export function useDataTableStoreSync() {
  const context = useContext(StoreContext);
  const { table, filterFields, sorting, rowSelection } = useDataTable();
  const { setFilters } = useFilterActions();
  const filterState = useFilterState<Record<string, unknown>>();
  const isInitialMount = useRef(true);
  const isSyncingRef = useRef(false);

  const columnFilters = table.getState().columnFilters;

  // Sync column filters
  useEffect(() => {
    if (!context) return;
    if (isSyncingRef.current) return;
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const updates: Record<string, unknown> = {};
    const filterFieldKeys = new Set(
      filterFields?.map((f) => f.value as string) || [],
    );
    let hasChanges = false;

    for (const filter of columnFilters) {
      if (filterFieldKeys.has(filter.id)) {
        const currentValue = filterState[filter.id];
        if (!isEqual(currentValue, filter.value)) {
          updates[filter.id] = filter.value;
          hasChanges = true;
        }
      }
    }

    for (const key of filterFieldKeys) {
      const hasFilter = columnFilters.some((f) => f.id === key);
      if (!hasFilter) {
        const currentValue = filterState[key];
        if (currentValue !== null && currentValue !== undefined) {
          updates[key] = null;
          hasChanges = true;
        }
      }
    }

    if (hasChanges) {
      isSyncingRef.current = true;
      setFilters(updates);
      queueMicrotask(() => {
        isSyncingRef.current = false;
      });
    }
  }, [columnFilters, context, filterFields, filterState, setFilters]);

  // Sync sorting
  useEffect(() => {
    if (!context) return;
    if (isSyncingRef.current) return;

    const currentSort = filterState.sort as
      | { id: string; desc: boolean }
      | null
      | undefined;
    const newSort = sorting?.[0] || null;

    if (!isEqual(currentSort, newSort)) {
      isSyncingRef.current = true;
      setFilters({ sort: newSort });
      queueMicrotask(() => {
        isSyncingRef.current = false;
      });
    }
  }, [sorting, context, filterState.sort, setFilters]);

  // Sync row selection (uuid)
  useEffect(() => {
    if (!context) return;
    if (isSyncingRef.current) return;

    const currentUuid = filterState.uuid as string | null | undefined;
    const selectedKeys = Object.keys(rowSelection || {});
    const newUuid = selectedKeys.length > 0 ? selectedKeys[0] : null;

    if (currentUuid !== newUuid) {
      isSyncingRef.current = true;
      setFilters({ uuid: newUuid });
      queueMicrotask(() => {
        isSyncingRef.current = false;
      });
    }
  }, [rowSelection, context, filterState.uuid, setFilters]);
}

/**
 * Zustand Slice Creator for Filter State
 *
 * Creates a namespaced slice for filter state that can be added to existing Zustand stores.
 */

import { getSchemaDefaults } from "../../schema/serialization";
import type { SchemaDefinition } from "../../schema/types";
import type { FilterSlice } from "./types";

/**
 * Create state keys for a filter slice (namespaced by table ID)
 */
export function getFilterSliceKeys(tableId: string) {
  return {
    state: `filters_${tableId}` as const,
    paused: `filters_${tableId}_paused` as const,
    pending: `filters_${tableId}_pending` as const,
    setFilters: `setFilters_${tableId}` as const,
    resetFilters: `resetFilters_${tableId}` as const,
    pauseFilters: `pauseFilters_${tableId}` as const,
    resumeFilters: `resumeFilters_${tableId}` as const,
  };
}

/**
 * Type helper for getting the slice keys type
 */
export type FilterSliceKeys = ReturnType<typeof getFilterSliceKeys>;

/**
 * Create a filter slice for a Zustand store
 *
 * @example
 * ```typescript
 * import { create } from 'zustand';
 * import { createFilterSlice } from '@/lib/store/adapters/zustand';
 *
 * const schema = createSchema({
 *   regions: field.array(field.string()).default([]),
 *   host: field.string(),
 * });
 *
 * const useStore = create((set, get) => ({
 *   // Your existing state
 *   user: null,
 *   theme: 'light',
 *
 *   // Add filter slice
 *   ...createFilterSlice(schema.definition, 'my-table', set, get),
 * }));
 * ```
 */
export function createFilterSlice<T extends Record<string, unknown>>(
  schema: SchemaDefinition,
  tableId: string,
  set: (
    partial:
      | Record<string, unknown>
      | ((state: Record<string, unknown>) => Record<string, unknown>),
  ) => void,
  get: () => Record<string, unknown>,
  initialState?: Partial<T>,
): Record<string, unknown> {
  const keys = getFilterSliceKeys(tableId);
  const defaults = getSchemaDefaults(schema) as T;
  const initial = { ...defaults, ...initialState };

  return {
    // State
    [keys.state]: initial,
    [keys.paused]: false,
    [keys.pending]: null,

    // Actions
    [keys.setFilters]: (partial: Partial<T>) => {
      const state = get();
      const isPaused = state[keys.paused] as boolean;

      if (isPaused) {
        const pending = (state[keys.pending] as Partial<T> | null) || {};
        set({ [keys.pending]: { ...pending, ...partial } });
        return;
      }

      const current = state[keys.state] as T;
      set({ [keys.state]: { ...current, ...partial } });
    },

    [keys.resetFilters]: (fields?: (keyof T)[]) => {
      const state = get();
      const current = state[keys.state] as T;

      if (fields) {
        const resetPartial: Partial<T> = {};
        for (const field of fields) {
          resetPartial[field] = defaults[field];
        }
        set({ [keys.state]: { ...current, ...resetPartial } });
      } else {
        set({ [keys.state]: defaults });
      }
    },

    [keys.pauseFilters]: () => {
      set({ [keys.paused]: true });
    },

    [keys.resumeFilters]: () => {
      const state = get();
      const pending = state[keys.pending] as Partial<T> | null;

      set({ [keys.paused]: false, [keys.pending]: null });

      if (pending) {
        const current = state[keys.state] as T;
        set({ [keys.state]: { ...current, ...pending } });
      }
    },
  };
}

/**
 * Get filter slice from a Zustand store state
 */
export function getFilterSliceFromState<T extends Record<string, unknown>>(
  state: Record<string, unknown>,
  tableId: string,
): FilterSlice<T> | null {
  const keys = getFilterSliceKeys(tableId);

  if (!(keys.state in state)) {
    return null;
  }

  return {
    filters: state[keys.state] as T,
    filtersPaused: state[keys.paused] as boolean,
    filtersPending: state[keys.pending] as Partial<T> | null,
    setFilters: state[keys.setFilters] as (partial: Partial<T>) => void,
    resetFilters: state[keys.resetFilters] as (fields?: (keyof T)[]) => void,
    pauseFilters: state[keys.pauseFilters] as () => void,
    resumeFilters: state[keys.resumeFilters] as () => void,
  };
}

/**
 * Zustand Adapter for BYOS
 *
 * This adapter integrates with existing Zustand stores via a slice pattern.
 * It is client-only and does not support SSR.
 */

"use client";

import { useMemo, useRef } from "react";
import type { StoreApi } from "zustand";
import type { InternalStoreAdapter } from "../../adapter/types";
import { getSchemaDefaults } from "../../schema/serialization";
import type { SchemaDefinition, StoreSnapshot } from "../../schema/types";
import { getFilterSliceKeys } from "./slice";
import type { ZustandAdapterOptions } from "./types";

export type {
  ZustandAdapterOptions,
  FilterSlice,
  FilterSliceState,
  FilterSliceActions,
} from "./types";
export {
  createFilterSlice,
  getFilterSliceKeys,
  getFilterSliceFromState,
} from "./slice";

/**
 * Create a Zustand adapter from an existing store
 *
 * @example
 * ```typescript
 * import { create } from 'zustand';
 * import { createFilterSlice, useZustandAdapter } from '@/lib/store/adapters/zustand';
 *
 * const schema = createSchema({
 *   regions: field.array(field.string()).default([]),
 *   host: field.string(),
 * });
 *
 * // Create store with filter slice
 * const useAppStore = create((set, get) => ({
 *   user: null,
 *   ...createFilterSlice(schema.definition, 'my-table', set, get),
 * }));
 *
 * // In component
 * function MyComponent() {
 *   const adapter = useZustandAdapter(useAppStore, schema.definition, { id: 'my-table' });
 *   return (
 *     <DataTableStoreProvider adapter={adapter}>
 *       <DataTable />
 *     </DataTableStoreProvider>
 *   );
 * }
 * ```
 */
export function useZustandAdapter<
  TStore extends Record<string, unknown>,
  TFilters extends Record<string, unknown>,
>(
  useStore: {
    (): TStore;
    getState: () => TStore;
    subscribe: (
      listener: (state: TStore, prevState: TStore) => void,
    ) => () => void;
  },
  schema: SchemaDefinition,
  options: ZustandAdapterOptions<TFilters>,
): InternalStoreAdapter<TFilters> {
  const { id, initialState } = options;
  const keys = getFilterSliceKeys(id);
  const defaults = useMemo(
    () => getSchemaDefaults(schema) as TFilters,
    [schema],
  );

  const versionRef = useRef(0);

  // Cache server snapshot to avoid infinite loop with useSyncExternalStore
  const serverSnapshotRef = useRef<StoreSnapshot<TFilters>>({
    state: { ...defaults, ...initialState } as TFilters,
    version: 0,
  });

  const adapter = useMemo<InternalStoreAdapter<TFilters>>(() => {
    const storeApi = useStore as unknown as StoreApi<TStore>;

    return {
      subscribe(listener: () => void) {
        return storeApi.subscribe(() => {
          versionRef.current++;
          listener();
        });
      },

      getSnapshot(): StoreSnapshot<TFilters> {
        const state = storeApi.getState();
        const filters = (state[keys.state] as TFilters) || defaults;
        return {
          state: filters,
          version: versionRef.current,
        };
      },

      // Zustand adapter is client-only, return cached snapshot for SSR
      getServerSnapshot(): StoreSnapshot<TFilters> {
        return serverSnapshotRef.current;
      },

      setState(partial: Partial<TFilters>) {
        const state = storeApi.getState();
        const setFilters = state[keys.setFilters] as
          | ((partial: Partial<TFilters>) => void)
          | undefined;

        if (setFilters) {
          setFilters(partial);
        } else {
          // Fallback: direct state update if slice actions not found
          const current = (state[keys.state] as TFilters) || defaults;
          (storeApi as unknown as StoreApi<Record<string, unknown>>).setState({
            [keys.state]: { ...current, ...partial },
          });
        }
      },

      setField<K extends keyof TFilters>(key: K, value: TFilters[K]) {
        this.setState({ [key]: value } as unknown as Partial<TFilters>);
      },

      reset(fields?: (keyof TFilters)[]) {
        const state = storeApi.getState();
        const resetFilters = state[keys.resetFilters] as
          | ((fields?: (keyof TFilters)[]) => void)
          | undefined;

        if (resetFilters) {
          resetFilters(fields);
        } else {
          // Fallback: direct reset
          if (fields) {
            const resetPartial: Partial<TFilters> = {};
            for (const field of fields) {
              resetPartial[field] = defaults[field];
            }
            this.setState(resetPartial);
          } else {
            (storeApi as unknown as StoreApi<Record<string, unknown>>).setState(
              {
                [keys.state]: defaults,
              },
            );
          }
        }
      },

      pause() {
        const state = storeApi.getState();
        const pauseFilters = state[keys.pauseFilters] as
          | (() => void)
          | undefined;

        if (pauseFilters) {
          pauseFilters();
        } else {
          (storeApi as unknown as StoreApi<Record<string, unknown>>).setState({
            [keys.paused]: true,
          });
        }
      },

      resume() {
        const state = storeApi.getState();
        const resumeFilters = state[keys.resumeFilters] as
          | (() => void)
          | undefined;

        if (resumeFilters) {
          resumeFilters();
        } else {
          const pending = state[keys.pending] as Partial<TFilters> | null;
          (storeApi as unknown as StoreApi<Record<string, unknown>>).setState({
            [keys.paused]: false,
            [keys.pending]: null,
          });

          if (pending) {
            this.setState(pending);
          }
        }
      },

      isPaused() {
        const state = storeApi.getState();
        return (state[keys.paused] as boolean) || false;
      },

      destroy() {
        // Nothing to clean up for Zustand adapter
      },

      getTableId() {
        return id;
      },

      getSchema() {
        return schema;
      },

      getDefaults() {
        return defaults;
      },
    };
  }, [useStore, schema, id, defaults, initialState, keys]);

  return adapter;
}

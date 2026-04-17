/**
 * Zustand Adapter Types
 */

import type { StoreApi } from "zustand";
import type { CreateAdapterOptions } from "../../adapter/types";

/**
 * Zustand-specific adapter options
 */
export interface ZustandAdapterOptions<T extends Record<string, unknown>>
  extends CreateAdapterOptions<T> {
  // Zustand adapter uses existing store integration, no additional options needed
}

/**
 * State shape for the filter slice in a Zustand store
 */
export interface FilterSliceState<T extends Record<string, unknown>> {
  filters: T;
  filtersPaused: boolean;
  filtersPending: Partial<T> | null;
}

/**
 * Actions for the filter slice
 */
export interface FilterSliceActions<T extends Record<string, unknown>> {
  setFilters: (partial: Partial<T>) => void;
  resetFilters: (fields?: (keyof T)[]) => void;
  pauseFilters: () => void;
  resumeFilters: () => void;
}

/**
 * Complete filter slice type
 */
export type FilterSlice<T extends Record<string, unknown>> =
  FilterSliceState<T> & FilterSliceActions<T>;

/**
 * Zustand store API type for adapter
 */
export type ZustandStoreApi<T> = StoreApi<T>;

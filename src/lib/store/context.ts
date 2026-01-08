/**
 * React Context for BYOS Store
 */

"use client";

import { createContext } from "react";
import type { StoreAdapter } from "./adapter/types";
import type { SchemaDefinition } from "./schema/types";

/**
 * Context value for the store provider
 */
export interface StoreContextValue<T extends Record<string, unknown>> {
  adapter: StoreAdapter<T>;
  schema: SchemaDefinition;
  tableId: string;
}

/**
 * React context for the store adapter
 * @internal
 */
export const StoreContext = createContext<StoreContextValue<
  Record<string, unknown>
> | null>(null);

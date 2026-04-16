/**
 * BYOS (Bring Your Own Store) - Main Exports
 *
 * This module provides a pluggable state management system for data tables.
 *
 * @example
 * ```typescript
 * // 1. Define schema
 * import { createSchema, field } from '@/lib/store';
 *
 * const schema = createSchema({
 *   regions: field.array(field.string()).default([]).delimiter(','),
 *   latency: field.array(field.number()).delimiter('-'),
 *   host: field.string(),
 *   live: field.boolean().default(false),
 * });
 *
 * // 2. Create adapter (nuqs for URL state)
 * import { useNuqsAdapter } from '@/lib/store/adapters/nuqs';
 *
 * const adapter = useNuqsAdapter(schema.definition, { id: 'my-table' });
 *
 * // 3. Use in component
 * import { DataTableStoreProvider, useFilterState, useFilterActions } from '@/lib/store';
 *
 * function MyTable() {
 *   return (
 *     <DataTableStoreProvider adapter={adapter}>
 *       <FilterControls />
 *       <DataTable />
 *     </DataTableStoreProvider>
 *   );
 * }
 *
 * function FilterControls() {
 *   const state = useFilterState();
 *   const { setFilter, resetAllFilters } = useFilterActions();
 *   // ...
 * }
 * ```
 */

// Schema
export { createSchema, field } from "./schema";
export type {
  Schema,
  SchemaDefinition,
  InferSchemaType,
  FieldBuilder,
  FieldConfig,
  StoreSnapshot,
  AdapterOptions,
} from "./schema";
export {
  getSchemaDefaults,
  serializeState,
  parseState,
  validateState,
  mergeWithDefaults,
  isStateEqual,
  stateToSearchString,
} from "./schema";

// Adapter Interface
export type {
  StoreAdapter,
  CreateAdapterOptions,
  AdapterFactory,
  AdapterType,
} from "./adapter";

// Provider
export { DataTableStoreProvider } from "./provider/DataTableStoreProvider";
export type { DataTableStoreProviderProps } from "./provider/DataTableStoreProvider";

// Hooks
export { useFilterState } from "./hooks/useFilterState";
export { useFilterActions, type FilterActions } from "./hooks/useFilterActions";
export { useFilterField, type FilterFieldResult } from "./hooks/useFilterField";
export { useReactTableSync } from "./hooks/useReactTableSync";

// Context (for advanced use cases)
export {
  StoreContext,
  useStoreContext,
  type StoreContextValue,
} from "./context";

// Text Parser
export { createTextParser } from "./parser";
export type { TextParser, TextParserOptions } from "./parser";

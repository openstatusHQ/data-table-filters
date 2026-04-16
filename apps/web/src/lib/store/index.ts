/**
 * BYOS (Bring Your Own Store) - Re-exports from @dtf/registry
 */

// Schema
export { createSchema, field } from "@dtf/registry/lib/store/schema";
export type {
  Schema,
  SchemaDefinition,
  InferSchemaType,
  FieldBuilder,
  FieldConfig,
  StoreSnapshot,
  AdapterOptions,
} from "@dtf/registry/lib/store/schema";
export {
  getSchemaDefaults,
  serializeState,
  parseState,
  validateState,
  mergeWithDefaults,
  isStateEqual,
  stateToSearchString,
} from "@dtf/registry/lib/store/schema";

// Adapter Interface
export type {
  StoreAdapter,
  CreateAdapterOptions,
  AdapterFactory,
  AdapterType,
} from "@dtf/registry/lib/store/adapter";

// Provider
export { DataTableStoreProvider } from "@dtf/registry/lib/store/provider/DataTableStoreProvider";
export type { DataTableStoreProviderProps } from "@dtf/registry/lib/store/provider/DataTableStoreProvider";

// Hooks
export { useFilterState } from "@dtf/registry/lib/store/hooks/useFilterState";
export {
  useFilterActions,
  type FilterActions,
} from "@dtf/registry/lib/store/hooks/useFilterActions";
export {
  useFilterField,
  type FilterFieldResult,
} from "@dtf/registry/lib/store/hooks/useFilterField";
export { useReactTableSync } from "@dtf/registry/lib/store/hooks/useReactTableSync";

// Context (for advanced use cases)
export {
  StoreContext,
  useStoreContext,
  type StoreContextValue,
} from "@dtf/registry/lib/store/context";

// Text Parser
export { createTextParser } from "@dtf/registry/lib/store/parser";
export type {
  TextParser,
  TextParserOptions,
} from "@dtf/registry/lib/store/parser";

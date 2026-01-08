# Specification: Bring Your Own Store (BYOS)

> Issue: https://github.com/openstatusHQ/data-table-filters/issues/40
>
> This spec enables replacing nuqs with custom state management (Zustand, or other client-side libraries) through a pluggable adapter pattern.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Schema Definition](#schema-definition)
4. [Adapter Interface](#adapter-interface)
5. [Official Adapters](#official-adapters)
6. [Provider API](#provider-api)
7. [Component Changes](#component-changes)
8. [DevTools](#devtools)
9. [Migration Guide](#migration-guide)
10. [File Structure](#file-structure)

---

## Overview

### Problem Statement

The current implementation is tightly coupled to nuqs for URL-based state management. This works well for traditional page-routed applications but becomes problematic for:

- Single-page applications (SPAs) without URL routing
- Applications requiring client-side-only state
- Use cases where URL state is undesirable (embedded widgets, modals, etc.)

### Solution

Implement a complete adapter pattern where:

- The core library is nuqs-free
- State management is handled through pluggable adapters
- nuqs becomes one of several official adapters
- Users can create custom adapters for any state management solution

### Key Decisions

| Decision                  | Choice                                                  |
| ------------------------- | ------------------------------------------------------- |
| Abstraction level         | Complete adapter pattern (nuqs-free core)               |
| Serialization             | Maintained for all stores (consistency + debuggability) |
| SSR support               | Client-only for non-URL adapters                        |
| State sync                | Automatic bidirectional via standardized interface      |
| Observable implementation | React 18's `useSyncExternalStore`                       |
| Persistence               | User responsibility (out of scope)                      |
| Package structure         | Single package with tree-shakeable imports              |
| Migration path            | Explicit breaking change                                |

---

## Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────────────────┐
│                      User Application                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              DataTableStoreProvider                      │   │
│  │  ┌─────────────────────────────────────────────────────┐ │   │
│  │  │                    Adapter                          │ │   │
│  │  │  ┌─────────┐  ┌──────────┐  ┌─────────────────┐   │ │   │
│  │  │  │  nuqs   │  │  Zustand │  │  Custom Adapter │   │ │   │
│  │  │  └─────────┘  └──────────┘  └─────────────────┘   │ │   │
│  │  └─────────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  DataTable   │  │ FilterCommand│  │  Filter Components   │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Core Hooks                            │   │
│  │  useFilterState() | useFilterActions() | useDataTable() │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### State Flow

```
Schema Definition
       │
       ▼
┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│   Adapter    │◄───►│    Store    │◄───►│  Components  │
│  (nuqs/zus)  │     │  (internal) │     │  (UI state)  │
└──────────────┘     └─────────────┘     └──────────────┘
       │                    │
       ▼                    ▼
┌──────────────┐     ┌─────────────┐
│ Serialized   │     │ React Table │
│   Output     │     │    State    │
└──────────────┘     └─────────────┘
```

### Subscription Model

Using React 18's `useSyncExternalStore` for efficient subscriptions:

```typescript
// Adapters provide these functions
interface StoreSubscription<T> {
  subscribe: (onStoreChange: () => void) => () => void;
  getSnapshot: () => T;
  getServerSnapshot?: () => T; // For SSR (URL adapter only)
}

// Core hooks use useSyncExternalStore internally
function useFilterState<T>(selector?: (state: FilterState) => T) {
  const adapter = useAdapter();

  return useSyncExternalStore(
    adapter.subscribe,
    selector ? () => selector(adapter.getSnapshot()) : adapter.getSnapshot,
    adapter.getServerSnapshot,
  );
}
```

---

## Schema Definition

### Overview

The schema serves as the single source of truth for:

- Filter field types
- Default values
- Serialization rules
- Validation constraints

### Syntax: Zod-like Fluent API

```typescript
import { createSchema, field } from "@/lib/data-table/schema";

export const filterSchema = createSchema({
  // Array of string literals
  level: field
    .array(field.stringLiteral(["error", "warn", "info", "debug"]))
    .default([])
    .delimiter(","),

  // Array of strings (freeform)
  region: field.array(field.string()).default([]).delimiter(","),

  // Numeric range (slider)
  latency: field
    .tuple(field.integer(), field.integer())
    .default([0, 5000])
    .delimiter("-"),

  // Date range
  timestamp: field
    .tuple(field.timestamp(), field.timestamp())
    .default([null, null])
    .delimiter("-"),

  // Single string
  url: field.string().default(""),

  // Sorting
  sort: field
    .object({ id: field.string(), desc: field.boolean() })
    .default(null)
    .serialize((v) => `${v.id}.${v.desc ? "desc" : "asc"}`)
    .parse((s) => {
      const [id, dir] = s.split(".");
      return { id, desc: dir === "desc" };
    }),
});

// Type inference
export type FilterState = InferSchemaType<typeof filterSchema>;
// => {
//   level: ('error' | 'warn' | 'info' | 'debug')[];
//   region: string[];
//   latency: [number, number];
//   timestamp: [Date | null, Date | null];
//   url: string;
//   sort: { id: string; desc: boolean } | null;
// }
```

### Field Types

```typescript
// Primitive types
field.string(); // string
field.integer(); // number (integer)
field.float(); // number (float)
field.boolean(); // boolean
field.timestamp(); // Date

// Constrained types
field.stringLiteral(["a", "b", "c"]); // 'a' | 'b' | 'c'
field.integerLiteral([1, 2, 3]); // 1 | 2 | 3

// Composite types
field.array(innerField); // T[]
field.tuple(field1, field2); // [T1, T2]
field
  .object({ key: field }) // { key: T }

  // Modifiers (chainable)
  .default(value) // Set default value
  .delimiter(char) // Set serialization delimiter
  .serialize(fn) // Custom serializer
  .parse(fn) // Custom parser
  .nullable(); // Allow null values
```

### Schema Utilities

```typescript
// Create schema with validation
const schema = createSchema(fields);

// Infer TypeScript types
type State = InferSchemaType<typeof schema>;

// Get default values
const defaults = getSchemaDefaults(schema);
// => { level: [], region: [], latency: [0, 5000], ... }

// Serialize state to string map
const serialized = serializeState(schema, state);
// => { level: 'error,warn', latency: '0-5000', ... }

// Parse string map to state
const parsed = parseState(schema, stringMap);
// => { level: ['error', 'warn'], latency: [0, 5000], ... }

// Validate and coerce (returns defaults on invalid)
const validated = validateState(schema, unknownData);
```

---

## Adapter Interface

### Core Interface

```typescript
interface DataTableAdapter<TState extends Record<string, unknown>> {
  /**
   * Unique identifier for namespacing (required for multi-table support)
   */
  readonly id: string;

  /**
   * Subscribe to state changes (for useSyncExternalStore)
   */
  subscribe: (onStoreChange: () => void) => () => void;

  /**
   * Get current state snapshot
   */
  getSnapshot: () => TState;

  /**
   * Get server-side snapshot (optional, for SSR)
   */
  getServerSnapshot?: () => TState;

  /**
   * Update state (supports partial updates)
   */
  setState: (
    partial: Partial<TState> | ((prev: TState) => Partial<TState>),
  ) => void;

  /**
   * Reset state to schema defaults
   */
  reset: () => void;

  /**
   * Pause state updates (for live mode)
   */
  pause: () => void;

  /**
   * Resume state updates
   */
  resume: () => void;

  /**
   * Check if updates are paused
   */
  isPaused: () => boolean;

  /**
   * Cleanup resources
   */
  destroy: () => void;
}
```

### Adapter Factory Signature

```typescript
type CreateAdapter<TState> = (
  schema: Schema<TState>,
  options: AdapterOptions,
) => DataTableAdapter<TState>;

interface AdapterOptions {
  /**
   * Unique ID for this adapter instance (enables multi-table support)
   */
  id: string;

  /**
   * Initial state (overrides schema defaults)
   */
  initialState?: Partial<TState>;
}
```

### Error Handling

Adapters must handle invalid state gracefully:

```typescript
// When state is invalid (corrupted localStorage, malformed URL, etc.)
// Adapter MUST:
// 1. Silently reset affected fields to schema defaults
// 2. NOT throw errors
// 3. NOT emit error events
// 4. Log to console.warn in development only

// Example implementation pattern:
function getSnapshot() {
  const rawState = getRawState();
  return validateState(schema, rawState); // Returns defaults for invalid fields
}
```

### Change Detection

Adapters use reference equality for change detection:

```typescript
// CORRECT: Create new array reference
setState((prev) => ({
  level: [...prev.level, "error"], // New array
}));

// INCORRECT: Mutate existing array
setState((prev) => {
  prev.level.push("error"); // Same reference, won't trigger update
  return prev;
});
```

---

## Official Adapters

### 1. nuqs Adapter

URL-based state management using nuqs. Supports SSR.

```typescript
import { createNuqsAdapter } from "@/lib/data-table/adapters/nuqs";

const adapter = createNuqsAdapter(filterSchema, {
  id: "my-table",
  // nuqs-specific options
  shallow: true, // Shallow routing (default: true)
  history: "push", // 'push' | 'replace' (default: 'push')
  scroll: false, // Scroll to top on change (default: false)
  throttleMs: 50, // Throttle URL updates (default: 50)
});
```

**Features:**

- Full SSR support via `getServerSnapshot`
- URL synchronization
- Browser history integration
- Shareable URLs

**Peer Dependencies:**

- `nuqs` >= 2.0.0

### 2. Zustand Adapter

Client-side state using Zustand. Integrates with existing stores.

```typescript
import {
  createZustandSlice,
  useZustandAdapter,
} from "@/lib/data-table/adapters/zustand";
import { create } from "zustand";

// Option A: Create slice for existing store
const useAppStore = create((set, get) => ({
  // Your existing state...
  user: null,
  theme: "light",

  // Add data table slice
  ...createZustandSlice(filterSchema, {
    id: "my-table",
    set,
    get,
  }),
}));

// Create adapter from store
const adapter = useZustandAdapter(useAppStore, "my-table");
```

**Features:**

- Integration with existing Zustand stores
- Zustand DevTools compatibility
- Middleware support (persist, immer, etc.)
- No SSR support (client-only)

**Peer Dependencies:**

- `zustand` >= 4.0.0

### Slice Structure

The Zustand slice adds these keys to your store:

```typescript
interface DataTableSlice<TState> {
  // Namespaced state
  [`dataTable_${id}_state`]: TState;
  [`dataTable_${id}_paused`]: boolean;

  // Actions (used internally by adapter)
  [`dataTable_${id}_setState`]: (partial: Partial<TState>) => void;
  [`dataTable_${id}_reset`]: () => void;
  [`dataTable_${id}_pause`]: () => void;
  [`dataTable_${id}_resume`]: () => void;
}
```

---

## Provider API

### DataTableStoreProvider

```typescript
import { DataTableStoreProvider } from '@/components/data-table';
import { createNuqsAdapter } from '@/lib/data-table/adapters/nuqs';

function MyPage() {
  const adapter = createNuqsAdapter(filterSchema, { id: 'logs-table' });

  return (
    <DataTableStoreProvider adapter={adapter}>
      <DataTable columns={columns} data={data} />
      <DataTableFilterCommand filterFields={filterFields} />
    </DataTableStoreProvider>
  );
}
```

### Multi-Table Support

Each table requires a unique ID for state isolation:

```typescript
function DashboardPage() {
  const logsAdapter = createNuqsAdapter(logsSchema, { id: 'logs' });
  const usersAdapter = createZustandAdapter(usersSchema, { id: 'users' });

  return (
    <div className="grid grid-cols-2">
      <DataTableStoreProvider adapter={logsAdapter}>
        <LogsTable />
      </DataTableStoreProvider>

      <DataTableStoreProvider adapter={usersAdapter}>
        <UsersTable />
      </DataTableStoreProvider>
    </div>
  );
}
```

### Core Hooks

```typescript
// Get entire filter state
const state = useFilterState();
// => { level: ['error'], region: [], latency: [0, 5000], ... }

// Get specific field (with selector for performance)
const level = useFilterState((s) => s.level);
// => ['error']

// Get filter actions
const { setState, reset, pause, resume, isPaused } = useFilterActions();

// Update filters
setState({ level: ["error", "warn"] });
setState((prev) => ({ level: [...prev.level, "info"] }));

// Reset to defaults
reset();

// Pause/resume (for live mode)
pause();
resume();
const paused = isPaused();
```

---

## Component Changes

### Split Component Architecture

The filter command component is split into parser-agnostic core and serialization module:

```
┌──────────────────────────────────────────────────────────────┐
│                  DataTableFilterCommand                       │
│  ┌────────────────────┐    ┌─────────────────────────────┐  │
│  │   Core Component   │    │    Text Parser Module       │  │
│  │   (parser-agnostic)│◄──►│   (standalone, optional)    │  │
│  └────────────────────┘    └─────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### DataTableFilterCommand

```typescript
interface DataTableFilterCommandProps<TData> {
  /**
   * Filter field definitions (unchanged from current API)
   */
  filterFields: DataTableFilterField<TData>[];

  /**
   * Enable text parsing (e.g., "level:error,warn region:ams")
   * Requires importing the text parser module
   * @default false
   */
  enableTextParsing?: boolean;

  /**
   * Custom text parser (overrides default)
   */
  textParser?: TextParser;
}
```

### Text Parser Module

Standalone module for parsing free-text filter input:

```typescript
import { createTextParser } from "@/lib/data-table/text-parser";

// Create parser from schema
const textParser = createTextParser(filterSchema, {
  // Field aliases (optional)
  aliases: {
    l: "level", // "l:error" → level: ['error']
    r: "region", // "r:ams,gru" → region: ['ams', 'gru']
  },

  // Custom value parsers (optional)
  valueParsers: {
    timestamp: (value) => {
      // Support relative dates: "timestamp:today-7d..today"
      return parseRelativeDate(value);
    },
  },
});

// Parse text to filter state
const filters = textParser.parse("level:error,warn region:ams latency:0-1000");
// => { level: ['error', 'warn'], region: ['ams'], latency: [0, 1000] }

// Serialize filter state to text
const text = textParser.serialize(filters);
// => 'level:error,warn region:ams latency:0-1000'
```

### Updated DataTable Component

```typescript
interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  filterFields: DataTableFilterField<TData>[];

  // Removed: searchParamsParser (now handled by adapter)
  // Removed: searchParamsCache (now handled by adapter)
}

function DataTable<TData, TValue>({
  columns,
  data,
  filterFields,
}: DataTableProps<TData, TValue>) {
  // State comes from adapter via hooks
  const filterState = useFilterState();
  const { setState } = useFilterActions();

  // Convert to React Table format
  const columnFilters = filterStateToColumnFilters(filterState);
  const sorting = filterState.sort ? [filterState.sort] : [];

  // Sync React Table state back to adapter
  const onColumnFiltersChange = (updater) => {
    const newFilters = functionalUpdate(updater, columnFilters);
    const stateUpdate = columnFiltersToFilterState(newFilters);
    setState(stateUpdate);
  };

  // ... rest of implementation
}
```

---

## DevTools

### Overview

Ship a DevTools component for debugging filter state, similar to React Query DevTools.

### Usage

```typescript
import { DataTableDevTools } from '@/components/data-table/devtools';

function App() {
  return (
    <>
      <DataTableStoreProvider adapter={adapter}>
        <DataTable />
      </DataTableStoreProvider>

      {/* DevTools panel (only in development) */}
      {process.env.NODE_ENV === 'development' && (
        <DataTableDevTools position="bottom-right" />
      )}
    </>
  );
}
```

### Features

1. **State Inspector**

   - Current filter state (formatted)
   - Schema defaults comparison
   - Serialized output preview

2. **History**

   - State change timeline
   - Diff view between states
   - Time-travel debugging (reset to previous state)

3. **Adapter Info**

   - Active adapter type
   - Adapter ID
   - Pause/resume status
   - Subscription count

4. **Actions**
   - Reset to defaults
   - Copy state as JSON
   - Import state from JSON
   - Toggle pause/resume

### Implementation

```typescript
function DataTableDevTools({ position = "bottom-right" }) {
  const [isOpen, setIsOpen] = useState(false);
  const state = useFilterState();
  const { reset, pause, resume, isPaused } = useFilterActions();
  const adapter = useAdapter();
  const [history, setHistory] = useState<StateSnapshot[]>([]);

  // Track state changes
  useEffect(() => {
    setHistory((prev) => [
      ...prev.slice(-50),
      {
        timestamp: Date.now(),
        state: structuredClone(state),
      },
    ]);
  }, [state]);

  // ... DevTools UI
}
```

---

## Migration Guide

### Breaking Changes

This is an explicit breaking change. Existing nuqs-based code must be migrated to the new adapter pattern.

### Before (Current API)

```typescript
// search-params.ts
import { createSearchParamsCache, parseAsArrayOf, parseAsString } from 'nuqs/server';

export const searchParamsParser = {
  level: parseAsArrayOf(parseAsString, ','),
  region: parseAsArrayOf(parseAsString, ','),
};

export const searchParamsCache = createSearchParamsCache(searchParamsParser);

// page.tsx
import { searchParamsCache } from './search-params';

export default function Page({ searchParams }) {
  const { level, region } = searchParamsCache.parse(searchParams);
  return <DataTable searchParamsParser={searchParamsParser} />;
}

// data-table.tsx
import { useQueryStates } from 'nuqs';
import { searchParamsParser } from './search-params';

function DataTable() {
  const [search, setSearch] = useQueryStates(searchParamsParser);
  // ...
}
```

### After (New Adapter API)

```typescript
// schema.ts
import { createSchema, field } from '@/lib/data-table/schema';

export const filterSchema = createSchema({
  level: field.array(field.string()).default([]).delimiter(','),
  region: field.array(field.string()).default([]).delimiter(','),
});

// page.tsx (for SSR with nuqs adapter)
import { createNuqsAdapter } from '@/lib/data-table/adapters/nuqs';
import { filterSchema } from './schema';

export default function Page({ searchParams }) {
  const adapter = createNuqsAdapter(filterSchema, { id: 'my-table' });

  return (
    <DataTableStoreProvider adapter={adapter}>
      <DataTable filterFields={filterFields} />
    </DataTableStoreProvider>
  );
}

// For SPA with Zustand adapter
import { createZustandAdapter } from '@/lib/data-table/adapters/zustand';

function SPAPage() {
  const adapter = createZustandAdapter(filterSchema, { id: 'my-table' });

  return (
    <DataTableStoreProvider adapter={adapter}>
      <DataTable filterFields={filterFields} />
    </DataTableStoreProvider>
  );
}
```

### Migration Checklist

1. **Create Schema**

   - [ ] Convert `searchParamsParser` to `filterSchema` using fluent API
   - [ ] Define defaults using `.default()`
   - [ ] Specify delimiters using `.delimiter()`

2. **Setup Adapter**

   - [ ] Choose adapter (nuqs for URL state, Zustand for client state)
   - [ ] Create adapter with schema and unique ID
   - [ ] Wrap components with `DataTableStoreProvider`

3. **Update Components**

   - [ ] Remove `searchParamsParser` prop from DataTable
   - [ ] Remove direct `useQueryStates` usage
   - [ ] Use `useFilterState()` and `useFilterActions()` hooks

4. **Update Server Components** (nuqs adapter only)

   - [ ] Remove `searchParamsCache.parse()` calls
   - [ ] Use adapter's `getServerSnapshot()` for SSR

5. **Update Data Fetching**
   - [ ] Update query key generation to use new serialization
   - [ ] Update API calls to use serialized filter state

---

## File Structure

```
src/
├── lib/
│   └── data-table/
│       ├── schema/
│       │   ├── index.ts              # createSchema, field builders
│       │   ├── types.ts              # Schema type definitions
│       │   ├── fields.ts             # Field type implementations
│       │   ├── serialization.ts      # serializeState, parseState
│       │   └── validation.ts         # validateState, getSchemaDefaults
│       │
│       ├── adapters/
│       │   ├── types.ts              # DataTableAdapter interface
│       │   ├── nuqs/
│       │   │   ├── index.ts          # createNuqsAdapter
│       │   │   └── nuqs-adapter.ts   # Implementation
│       │   └── zustand/
│       │       ├── index.ts          # createZustandSlice, useZustandAdapter
│       │       └── zustand-adapter.ts # Implementation
│       │
│       ├── text-parser/
│       │   ├── index.ts              # createTextParser
│       │   └── parser.ts             # Text parsing implementation
│       │
│       └── index.ts                  # Public exports
│
├── components/
│   └── data-table/
│       ├── data-table-store-provider.tsx  # Provider component
│       ├── hooks/
│       │   ├── use-filter-state.ts        # useFilterState hook
│       │   ├── use-filter-actions.ts      # useFilterActions hook
│       │   └── use-adapter.ts             # useAdapter hook (internal)
│       │
│       ├── data-table-filter-command/
│       │   ├── index.tsx                  # Main component (parser-agnostic)
│       │   └── utils.ts                   # Utility functions
│       │
│       ├── devtools/
│       │   ├── index.tsx                  # DevTools component
│       │   ├── state-inspector.tsx        # State display
│       │   ├── history-panel.tsx          # History timeline
│       │   └── actions-panel.tsx          # Action buttons
│       │
│       └── index.ts                       # Public component exports
│
└── app/
    ├── default/                     # Example: nuqs adapter
    │   ├── schema.ts
    │   ├── page.tsx
    │   └── data-table.tsx
    │
    └── spa/                         # Example: Zustand adapter
        ├── schema.ts
        ├── page.tsx
        └── data-table.tsx
```

---

## Summary

This specification defines a complete adapter pattern for data-table-filters that:

1. **Decouples** the core library from nuqs
2. **Enables** SPA use cases with client-side state (Zustand)
3. **Maintains** serialization for consistency and debuggability
4. **Provides** automatic bidirectional sync via `useSyncExternalStore`
5. **Supports** multiple tables via auto-namespacing
6. **Includes** DevTools for debugging
7. **Ships** with two official adapters (nuqs, Zustand)

The migration is an explicit breaking change, requiring users to adopt the new schema-based adapter pattern.

# Auto-Infer API

Zero-config schema inference from raw JSON data. Requires the **data-table-schema** block.

## Table of Contents

- [inferSchemaFromJSON](#inferschemafromjson)
- [createTableSchema.fromJSON](#createtableschemafromjson)
- [DataTableAuto Component](#datatableauto-component)
- [Inference Heuristics](#inference-heuristics)
- [Smart Enhancements](#smart-enhancements)

---

## inferSchemaFromJSON

```tsx
import { inferSchemaFromJSON } from "@/lib/table-schema/infer";

const schemaJson = inferSchemaFromJSON(data); // SchemaJSON
```

Walks all rows, collects per-key values, and infers `ColKind` + `FilterType` for each column. Returns a `SchemaJSON` descriptor (function-free, serializable).

---

## createTableSchema.fromJSON

```tsx
import { createTableSchema } from "@/lib/table-schema";

const { definition } = createTableSchema.fromJSON(schemaJson);
```

Reconstructs a `TableSchemaDefinition` from a `SchemaJSON` descriptor. The returned `definition` works with all generators (`generateColumns`, `generateFilterFields`, `generateFilterSchema`, `generateSheetFields`, `getDefaultColumnVisibility`).

Round-trips: `createTableSchema.fromJSON(schema.toJSON())` produces an equivalent schema.

---

## DataTableAuto Component

All-in-one wrapper that chains `inferSchemaFromJSON` → `createTableSchema.fromJSON` → generators → `DataTableInfinite`:

```tsx
import { DataTableAuto } from "@/components/data-table/data-table-auto";

// data: Record<string, unknown>[]
<DataTableAuto data={data} />;
```

Includes: memory adapter, command palette, sheet detail panel, auto column visibility.

**Working example:** `src/app/auto/page.tsx` — renders `bookmarks.json` with zero configuration.

---

## Inference Heuristics

| Data pattern                               | Inferred type | Filter type |
| ------------------------------------------ | ------------- | ----------- |
| ISO 8601 strings (`2024-01-15T...`)        | `timestamp`   | `timerange` |
| Unix-ms numbers (13-digit, 2001–2286)      | `timestamp`   | `timerange` |
| All `true`/`false`                         | `boolean`     | `checkbox`  |
| All numbers (min ≠ max)                    | `number`      | `slider`    |
| All numbers (min = max)                    | `number`      | `input`     |
| Strings with ≤ 10 distinct values          | `enum`        | `checkbox`  |
| Strings with > 10 distinct values          | `string`      | `input`     |
| Arrays of strings with ≤ 10 distinct items | `array`       | `checkbox`  |
| Plain objects                              | `record`      | none        |
| Mixed/ambiguous types                      | `string`      | `input`     |

---

## Smart Enhancements

After inference, `enhanceDescriptor` applies keyword-based heuristics on column names:

| Column name pattern                           | Enhancement                               |
| --------------------------------------------- | ----------------------------------------- |
| Contains `id`, `uuid`, `hash`, `token`, `key` | `code` display, not sortable              |
| Contains `trace`/`span`/`request` + `id`      | Hidden, not filterable                    |
| Contains `favorite`, `starred`, `bookmarked`  | `star` display (boolean columns)          |
| Contains `email`, `mail`                      | `code` display                            |
| Contains `path`, `url`, `uri`, `endpoint`     | `code` display                            |
| Contains `latency`, `duration`, `elapsed`     | `number` display with `ms` unit, sortable |
| Contains `size`, `bytes`, `length`            | `number` display with `B` unit, sortable  |
| Contains `level`, `severity`                  | Enum filter expanded by default           |
| Contains `status`, `state`                    | Badge with semantic colors                |

Semantic colors for status values: `active`/`completed`/`success` → green, `pending`/`draft` → amber, `error`/`failed` → red, `archived`/`deleted` → gray.

Default column sizing: boolean 100px, timestamp 180px, number 120px, enum 130px.

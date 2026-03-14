# Schema API

**Install:** `npx shadcn@latest add https://data-table.openstatus.dev/r/data-table-schema.json`

## Table of Contents

- [createTableSchema](#createtableschema)
- [Column Factories (col.\*)](#column-factories)
- [Builder Methods](#builder-methods)
- [Presets](#presets)
- [Generators](#generators)
- [Data Type Mapping](#data-type-mapping)

---

## createTableSchema

```tsx
import { createTableSchema, col } from "@/lib/table-schema";

export const tableSchema = createTableSchema({
  name: col.string().label("Name").filterable("input"),
  status: col
    .enum(["active", "inactive"] as const)
    .label("Status")
    .filterable("checkbox"),
  price: col
    .number()
    .label("Price")
    .filterable("slider", { min: 0, max: 1000, unit: "$" }),
  createdAt: col
    .timestamp()
    .label("Created")
    .filterable("timerange")
    .sortable(),
});

export type Row = InferTableType<typeof tableSchema.definition>;
```

---

## Column Factories

| Factory                  | Type                     | Default filter                        |
| ------------------------ | ------------------------ | ------------------------------------- |
| `col.string()`           | `string`                 | `"input"`                             |
| `col.number()`           | `number`                 | `"input"` / `"slider"` / `"checkbox"` |
| `col.boolean()`          | `boolean`                | `"checkbox"`                          |
| `col.timestamp()`        | `Date`                   | `"timerange"`                         |
| `col.enum(values)`       | `T[number]`              | `"checkbox"`                          |
| `col.array(itemBuilder)` | `U[]`                    | `"checkbox"`                          |
| `col.record()`           | `Record<string, string>` | none (display only)                   |

---

## Builder Methods

All methods are chainable.

### Display

```tsx
.label(text: string)          // Column header label
.description(text: string)    // Tooltip description
.display(type, options?)      // Cell renderer type
.size(px: number)             // Column width in px
.resizable()                  // Allow column resize
.hidden()                     // Hidden by default (toggle via view options)
.hideHeader()                 // Hide column header text
```

Display types: `"text"`, `"code"`, `"boolean"`, `"badge"`, `"timestamp"`, `"number"`, `"status-code"`, `"level-indicator"`, `"custom"`.

### Filtering

```tsx
.filterable()                                              // Default filter for type
.filterable("input")                                       // Text input
.filterable("checkbox", { options?, component? })           // Checkbox list
.filterable("slider", { min, max, unit? })                 // Range slider
.filterable("timerange", { presets? })                     // Date range
.notFilterable()                                           // Exclude from filters
.defaultOpen()                                             // Expand filter by default
.commandDisabled()                                         // Exclude from command palette
```

### Sorting & Layout

```tsx
.sortable()                   // Enable column sorting
.optional()                   // Column is optional
.sheet(config?)               // Include in sheet detail panel
.sheetOnly()                  // Only show in sheet (hidden in table)
```

---

## Presets

Pre-configured columns for common patterns:

```tsx
col.presets.logLevel(["error", "warn", "info"] as const)
// → enum + badge display + checkbox filter + defaultOpen

col.presets.httpMethod(["GET", "POST", "PUT", "DELETE"] as const)
// → enum + text display + checkbox filter

col.presets.httpStatus()
// → number + status-code display + checkbox filter (common HTTP codes)

col.presets.duration(unit?: string, slider?: { min, max })
// → number + formatted display + slider filter (default: 0-5000ms)

col.presets.timestamp()
// → Date + relative display + timerange filter + sortable

col.presets.traceId()
// → string + code display + not filterable

col.presets.pathname()
// → string + text display + input filter
```

---

## Generators

Generate TanStack Table compatible configs from schema:

```tsx
import {
  generateColumns,
  generateFilterFields,
  generateFilterSchema,
  generateSheetFields,
} from "@/lib/table-schema";

const columns = generateColumns<Row>(tableSchema.definition);
const filterFields = generateFilterFields<Row>(tableSchema.definition);
const filterSchema = generateFilterSchema(tableSchema.definition);
const sheetFields = generateSheetFields<Row>(tableSchema.definition);
```

| Generator                | Returns                     | Use for                           |
| ------------------------ | --------------------------- | --------------------------------- |
| `generateColumns()`      | `ColumnDef<T>[]`            | TanStack Table column definitions |
| `generateFilterFields()` | `DataTableFilterField<T>[]` | Filter UI configuration           |
| `generateFilterSchema()` | Store schema definition     | BYOS adapter filter schema        |
| `generateSheetFields()`  | `SheetField<T>[]`           | Sheet detail panel fields         |

### Sheet Fields & Filter Dropdowns

`generateSheetFields()` auto-derives each field's `type` from its filter config. This controls whether the sheet row gets a filter dropdown:

| `SheetField.type` | Derived from               | Sheet dropdown options                          |
| ----------------- | -------------------------- | ----------------------------------------------- |
| `"readonly"`      | No filter config           | No dropdown — plain display + copy only         |
| `"checkbox"`      | `.filterable("checkbox")`  | "Include" (adds value to array filter)          |
| `"input"`         | `.filterable("input")`     | "Include" (sets text filter)                    |
| `"slider"`        | `.filterable("slider")`    | "Less or equal", "Greater or equal", "Equal to" |
| `"timerange"`     | `.filterable("timerange")` | "Exact timestamp", "Same hour", "Same day"      |

Use `generateSheetFields()` whenever possible — it handles this mapping automatically. If manually defining `sheetFields`, set `type` to match the corresponding `filterFields` entry to get the dropdown.

### Filter Schema for Store Adapters

`generateFilterSchema` produces a schema compatible with all adapters:

- `string + input` → `field.string()`
- `number + slider` → `field.array(field.number())` with slider delimiter
- `timestamp + timerange` → `field.array(field.timestamp())` with range delimiter
- `enum + checkbox` → `field.array(field.stringLiteral(values))`

---

## Data Type Mapping

When generating a schema from a user's data model:

| User's data type          | col.\* factory                | Suggested filter                         |
| ------------------------- | ----------------------------- | ---------------------------------------- |
| `string`                  | `col.string()`                | `.filterable("input")`                   |
| `number`                  | `col.number()`                | `.filterable("slider", { min, max })`    |
| `boolean`                 | `col.boolean()`               | `.filterable("checkbox")`                |
| `Date` / `timestamp`      | `col.timestamp()`             | `.filterable("timerange")`               |
| `enum` / union of strings | `col.enum(values)`            | `.filterable("checkbox")`                |
| `string[]` / `enum[]`     | `col.array(col.enum(values))` | `.filterable("checkbox")`                |
| `Record<string, string>`  | `col.record()`                | `.notFilterable().sheet()`               |
| UUID / ID                 | `col.string()`                | `.notFilterable()` or `.display("code")` |

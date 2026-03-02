# Plan: Enrich Builder Example Datasets

## Context
The builder's example datasets are all visually generic and the sheet panel is always empty. The `inferSchemaFromJSON` function sets `sheet: null` on every column it infers, so `generateSheetFields` skips them all. Additionally each dataset lacks uniqueness — they all look the same once loaded. The goal is to make each dataset feel distinct through row-level color cues, richer data fields, and per-dataset sheet titles.

---

## 1. Fix the empty sheet — `src/lib/table-schema/infer.ts`

**Root cause:** `makeDescriptor()` always sets `sheet: null`. The two inline objects (enum and array branches) also hardcode `sheet: null`.

**Fix:** Change every `sheet: null` to `sheet: {}` inside `inferSchemaFromJSON`. This means all auto-inferred columns are included in the sheet panel with default settings.

---

## 2. Add new fields to each dataset — `src/app/builder/placeholder-data.ts`

New fields must be chosen so the auto-infer logic produces interesting column types (enum badge, slider, timestamp, input). All 8 datasets get 1–2 new fields:

| Dataset | New field(s) | Inferred as |
|---|---|---|
| **Employees** | `level` (Junior/Mid/Senior/Lead/Principal), `joined` (ISO date) | enum badge, timestamp |
| **HTTP Logs** | `host` (3 distinct domains) | enum checkbox |
| **Notes** | `word_count` (number 5–120) | slider |
| **Auction Bids** | `bid_count` (number 1–45), `ending_at` (ISO date) | slider, timestamp |
| **Orders** | `total` (price × quantity, pre-computed number) | slider |
| **Issues** | `estimate` (number of hours, 1–20) | slider |
| **Movies** | `director` (>10 distinct strings) | input text |
| **Locations** | `rating` (number 1.0–5.0) | slider |

---

## 3. Per-dataset configs — new file `src/app/builder/builder-configs.ts`

A single exported map keyed by dataset label. Each entry has optional `getRowClassName` and `renderSheetTitle`. No JSX needed — both return plain strings.

```ts
export type BuilderDatasetConfig = {
  getRowClassName?: (row: { original: Record<string, unknown> }) => string;
  renderSheetTitle?: (props: { row?: { original: Record<string, unknown> } }) => string;
};

export const BUILDER_DATASET_CONFIGS: Record<string, BuilderDatasetConfig> = {
  Employees: {
    getRowClassName: (row) => (row.original.active === false ? "opacity-60" : ""),
    renderSheetTitle: ({ row }) =>
      row ? `${row.original.name} · ${row.original.department}` : "",
  },
  "HTTP Logs": {
    getRowClassName: (row) => {
      const s = row.original.status as number;
      if (s >= 500) return "bg-destructive/5";
      if (s >= 400) return "bg-amber-500/5";
      return "";
    },
    renderSheetTitle: ({ row }) =>
      row ? `${row.original.method} ${row.original.path}` : "",
  },
  Notes: {
    getRowClassName: (row) =>
      row.original.pinned === true ? "bg-amber-500/5" : "",
  },
  "Auction Bids": {
    getRowClassName: (row) => {
      const s = row.original.status as string;
      if (s === "won") return "bg-emerald-500/5";
      if (s === "cancelled") return "opacity-60";
      return "";
    },
  },
  Orders: {
    getRowClassName: (row) => {
      const s = row.original.status as string;
      if (s === "cancelled") return "opacity-60";
      if (s === "delivered") return "bg-emerald-500/5";
      return "";
    },
    renderSheetTitle: ({ row }) =>
      row ? `${row.original.order_id} · ${row.original.product}` : "",
  },
  Issues: {
    getRowClassName: (row) =>
      row.original.priority === "critical" ? "bg-destructive/5" : "",
  },
  Movies: {
    getRowClassName: (row) =>
      row.original.watched === false ? "opacity-60" : "",
  },
  Locations: {
    getRowClassName: (row) =>
      row.original.verified === false ? "opacity-60" : "",
    renderSheetTitle: ({ row }) =>
      row ? `${row.original.name}, ${row.original.city}` : "",
  },
};
```

---

## 4. Thread config into the table — `src/app/builder/builder-table.tsx`

Add two optional props to `BuilderTableProps` and `BuilderTableInner`:
- `getRowClassName?: (row: { original: Record<string, unknown> }) => string`
- `renderSheetTitle?: (props: { row?: { original: Record<string, unknown> } }) => string`

Forward them to `DataTableInfinite`. Keep the existing default fallback for `renderSheetTitle` when no config is provided:

```tsx
<DataTableInfinite
  ...
  getRowClassName={getRowClassName}
  renderSheetTitle={
    renderSheetTitle ??
    (({ row }) => row ? String(Object.values(row.original)[0] ?? "") : "")
  }
/>
```

---

## 5. Look up and pass config — `src/app/builder/builder-client.tsx`

Import `BUILDER_DATASET_CONFIGS`. Derive the active config from `currentDatasetLabel` (already tracked in state) and pass it to `BuilderTable`:

```tsx
import { BUILDER_DATASET_CONFIGS } from "./builder-configs";

const datasetConfig = BUILDER_DATASET_CONFIGS[currentDatasetLabel] ?? {};

<BuilderTable
  data={parsedData}
  schemaJson={schemaJson}
  schemaVersion={schemaVersion}
  getRowClassName={datasetConfig.getRowClassName}
  renderSheetTitle={datasetConfig.renderSheetTitle}
/>
```

---

## Files to change

| File | Change |
|---|---|
| `src/lib/table-schema/infer.ts` | `sheet: null` → `sheet: {}` (4 occurrences) |
| `src/app/builder/placeholder-data.ts` | Add new fields to all 8 datasets |
| `src/app/builder/builder-configs.ts` | **New file** — per-dataset config map |
| `src/app/builder/builder-table.tsx` | Add + forward `getRowClassName`, `renderSheetTitle` props |
| `src/app/builder/builder-client.tsx` | Import config map, derive + pass to `BuilderTable` |

---

## Verification

1. Open `/builder`, default dataset (Employees) loads — inactive employees are dimmed
2. Click Shuffle to cycle through all 8 datasets — each has distinct row colors
3. Click any row to open the sheet — all fields are visible (not empty)
4. Sheet title shows correct per-dataset format (e.g. `"GET /api/users"` for HTTP Logs)
5. Run `bun test` — all 189 tests pass (`infer.test.ts` covers the infer.ts change)

# Builder Improvements

Suggested improvements for the `feat/builder` branch, grouped by priority.

---

## High Priority — Functional Gaps

### 1. `generateBuilderSheetFields` should use the inferred schema

`builder-table.tsx` has its own inline `generateBuilderSheetFields()` that renders every column as `"readonly"` with `JSON.stringify`. The real `generateSheetFields()` from the library is never called in the builder. The sheet drawer in the preview is therefore not representative of what users would get in production.

**Fix:** Replace the inline function with a call to `generateSheetFields(schema)` from the library, so the builder preview matches the exported code.

---

### 2. `col.enum()` options not wired up end-to-end

The `col.enum(values)` factory does not auto-populate `filter.options` — option derivation is deferred to `generateFilterFields`. If a user calls `.filterable("checkbox")` manually (e.g. in their exported TypeScript), they get an empty options list.

**Options:**

- Auto-derive `filter.options` inside the `col.enum()` factory itself.
- Or document clearly that `generateFilterFields` is the canonical consumer and the factory alone is incomplete.

---

### 3. `schemaToTypeScript` doesn't emit `col.presets.*`

The TypeScript export always emits raw `col.*` factory calls, even when the inferred schema matches a preset (`logLevel`, `httpMethod`, `httpStatus`, etc.). The exported code could be much shorter and more idiomatic.

**Fix:** In `to-typescript.ts`, detect preset patterns and emit `col.presets.logLevel()` etc. instead of the expanded factory chain.

---

## Medium Priority — UX / Developer Experience

### 4. Left panel fixed at 300px is too narrow

Schema JSON for tables with many columns quickly overflows the 300px left panel. It makes editing uncomfortable.

**Fix:** Make the panel resizable with a drag handle, or at minimum increase the default width (e.g. `max-w-[400px]`).

---

### 5. Validation errors from `Apply` are not surfaced

When the user edits the schema JSON into an invalid state (e.g. a slider without `min`/`max`) and hits Apply, the error is caught silently — the button appears to do nothing. The errors from `validateSchema()` should be displayed in the UI.

**Fix:** Catch and display `validateSchema()` errors below the schema editor after an Apply attempt.

---

### 6. Schema editor has no syntax highlighting

The schema editor is a plain `<textarea>`. For a tool centered on editing JSON, this makes it easy to miss syntax errors and hard to read nested structure.

**Fix:** Replace with a lightweight code editor (e.g. CodeMirror) or at least a `<pre contenteditable>` with basic JSON highlighting.

---

### 7. "AI" tab is a dead end

The AI tab renders "coming soon" with no further context. This is a missed opportunity to communicate what the feature will do.

**Fix:** Add a short description (e.g. "Describe your data in plain English and get a schema generated automatically") and optionally a mocked input to hint at the future UX.

---

## Low Priority — Polish / Correctness

### 8. Mixed-type column inference falls back to `string` silently

If a column contains both strings and numbers (common in real-world JSON dumps), `inferSchemaFromJSON` silently falls through to a `string` input filter. Users get no indication that the column type was ambiguous.

**Fix:** Log a warning or annotate the inferred column descriptor (e.g. a comment in the exported TS) when the inference falls back due to mixed types.

---

### 9. Number `"input"` filter uses exact-match (`equals`) filterFn

When slider is not applicable (e.g. `min === max`, or a single-value column), `col.number()` falls back to `"input"` filter with an `equals` filterFn. Users typically expect substring or range matching for numeric input filters.

**Fix:** Consider a `"range"` or `"contains"` semantic for number input filters, or make the filterFn configurable.

---

### 10. Timeline chart is empty in builder preview

`chartData` and `chartDataColumnId` are wired up as an empty array and `undefined`, so the chart area in the preview shows nothing.

**Options:**

- Hide the chart area entirely in builder mode.
- Auto-detect the first `timestamp` column and generate a basic count-per-bucket chart from the data to make the preview richer.

---

### 11. `col.number().filterable("checkbox")` path is silently broken

There is no way to auto-derive options for a number checkbox filter — the factory has no value list to pull from. This silently produces a filter with no options, which is a confusing no-op in the UI.

**Fix:** Either warn during `validateSchema()` when a number checkbox filter has no options, or disable the checkbox filter type for `col.number()` unless explicit options are provided.

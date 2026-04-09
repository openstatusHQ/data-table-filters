import type { DatePreset, Option } from "@/components/data-table/types";
import type { JSX } from "react";

export type ColKind =
  | "string"
  | "number"
  | "boolean"
  | "timestamp"
  | "enum"
  | "array"
  | "record"
  | "select";

/** The set of filter UI types. Used as the `F` generic on `ColBuilder<T, F>`. */
export type FilterType = "input" | "checkbox" | "slider" | "timerange";

export type DisplayConfig =
  | { type: "text"; colorMap?: Record<string, string> }
  | { type: "code"; colorMap?: Record<string, string> }
  | { type: "boolean"; colorMap?: Record<string, string> }
  | { type: "star"; colorMap?: Record<string, string> }
  | { type: "badge"; colorMap?: Record<string, string> }
  | { type: "timestamp"; colorMap?: Record<string, string> }
  | { type: "number"; unit?: string; colorMap?: Record<string, string> }
  | {
      type: "bar";
      min?: number;
      max?: number;
      unit?: string;
      color?: string;
      colorMap?: Record<string, string>;
    }
  | {
      type: "heatmap";
      min?: number;
      max?: number;
      unit?: string;
      color?: string;
      colorMap?: Record<string, string>;
    }
  | {
      type: "gauge";
      min?: number;
      max?: number;
      unit?: string;
      color?: string;
      colorMap?: Record<string, string>;
    }
  | { type: "status-code"; colorMap?: Record<string, string> }
  | { type: "level-indicator"; colorMap?: Record<string, string> }
  | {
      type: "custom";
      cell: (value: unknown, row: unknown) => JSX.Element | null;
      colorMap?: Record<string, string>;
    };

export type FilterConfig = {
  type: FilterType;
  defaultOpen: boolean;
  commandDisabled: boolean;
  options?: Option[];
  component?: (props: Option) => JSX.Element | null;
  min?: number;
  max?: number;
  unit?: string;
  presets?: DatePreset[];
};

export type SheetConfig = {
  label?: string;
  component?: (row: unknown) => JSX.Element | null | string;
  condition?: (row: unknown) => boolean;
  className?: string;
  skeletonClassName?: string;
};

export type ColConfig = {
  kind: ColKind;
  enumValues?: readonly string[];
  arrayItem?: ColConfig;
  optional: boolean;
  label: string;
  description?: string;
  display: DisplayConfig;
  size?: number;
  hidden: boolean;
  enableHiding: boolean;
  hideHeader: boolean;
  resizable: boolean;
  sortable: boolean;
  filter: FilterConfig | null;
  sheet: SheetConfig | null;
};

/**
 * A fluent builder for a single table column.
 *
 * `T` — TypeScript type of the column's data value (inferred by `InferTableType`).
 * `F` — union of filter UI types valid for this col kind (compile-time constraint):
 *
 * | Factory            | Allowed filter types                    |
 * |--------------------|-----------------------------------------|
 * | `col.string()`     | `"input"`                               |
 * | `col.number()`     | `"input" \| "slider" \| "checkbox"`     |
 * | `col.boolean()`    | `"checkbox"`                            |
 * | `col.timestamp()`  | `"timerange"`                           |
 * | `col.enum()`       | `"checkbox"`                            |
 * | `col.array()`      | `"checkbox"`                            |
 * | `col.record()`     | `never` — `filterable()` is an error    |
 *
 * Calling `filterable(type)` with a type not in `F` is a **compile-time error**.
 */
export interface ColBuilder<T, F extends FilterType = FilterType> {
  /** @internal Raw column configuration. Used by generators — do not access directly. */
  readonly _config: ColConfig;

  /**
   * Sets the column header label shown in the table and filter sidebar.
   *
   * @example
   * col.string().label("Host")
   * col.enum(LEVELS).label("Severity")
   */
  label(text: string): ColBuilder<T, F>;

  /**
   * Attaches a human-readable description of the column's domain meaning.
   *
   * Not shown in the UI. Used by AI agents and MCP tools (via `toJSON()`) to
   * understand what the column represents.
   *
   * @example
   * col.number().label("Latency").description("Round-trip time from request to response, in ms")
   * col.enum(LEVELS).label("Level").description("Log severity: error > warn > info > debug")
   */
  description(text: string): ColBuilder<T, F>;

  /**
   * Sets how the column value is rendered in table cells.
   *
   * Built-in display types:
   * - `"text"` — plain text, truncated with tooltip on overflow
   * - `"code"` — monospace font (IDs, hashes, paths, hostnames)
   * - `"boolean"` — checkmark / dash icon
   * - `"badge"` — colored chip (enums, categories, tags)
   * - `"timestamp"` — relative time ("3m ago"), absolute datetime on hover
   * - `"number"` — formatted number with optional `unit` suffix
   * - `"bar"` — horizontal bar with `min`/`max` range and optional `unit`
   * - `"heatmap"` — background color intensity based on `min`/`max` range
   * - `"custom"` — developer-supplied JSX renderer (not serializable)
   *
   * @example
   * col.string().display("code")
   * col.number().display("number", { unit: "ms" })
   * col.number().display("bar", { min: 0, max: 5000, unit: "ms" })
   * col.number().display("heatmap", { min: 0, max: 100 })
   * col.enum(LEVELS).display("custom", { cell: (value) => <LevelBadge value={value} /> })
   */
  display(
    type:
      | "text"
      | "code"
      | "boolean"
      | "star"
      | "badge"
      | "timestamp"
      | "status-code"
      | "level-indicator",
    options?: { colorMap?: Record<string, string> },
  ): ColBuilder<T, F>;
  display(
    type: "number",
    options?: { unit?: string; colorMap?: Record<string, string> },
  ): ColBuilder<T, F>;
  display(
    type: "bar",
    options: {
      min: number;
      max: number;
      unit?: string;
      colorMap?: Record<string, string>;
    },
  ): ColBuilder<T, F>;
  display(
    type: "heatmap",
    options: {
      min: number;
      max: number;
      color?: string;
      colorMap?: Record<string, string>;
    },
  ): ColBuilder<T, F>;
  display(
    type: "custom",
    options: {
      cell: (value: unknown, row: unknown) => JSX.Element | null;
      colorMap?: Record<string, string>;
    },
  ): ColBuilder<T, F>;
  display(
    type: "heatmap" | "bar" | "gauge",
    options?: {
      min?: number;
      max?: number;
      unit?: string;
      color?: string;
    },
  ): ColBuilder<T, F>;

  /**
   * Enables filtering for this column using its default filter type.
   *
   * For `col.record()` (`F = never`) this is a **compile-time error**.
   * Use `.notFilterable()` on record columns instead (it is already the default).
   */
  filterable(...args: [F] extends [never] ? [never] : []): ColBuilder<T, F>;

  /**
   * Enables filtering with an explicit filter type and optional configuration.
   *
   * Only types in `F` are accepted — passing an invalid type is a **compile-time error**:
   * - `"input"` — free-text or number search field
   * - `"timerange"` — date range picker (with optional `presets`)
   * - `"checkbox"` — multi-select from a list of `options`
   * - `"slider"` — numeric range with required `min` / `max` bounds
   *
   * @example
   * col.string().filterable("input")
   * col.timestamp().filterable("timerange")
   * col.enum(LEVELS).filterable("checkbox", { options: LEVELS.map(v => ({ label: v, value: v })) })
   * col.number().filterable("slider", { min: 0, max: 5000 })
   */
  filterable(type: F & "input"): ColBuilder<T, "input">;
  filterable(
    type: F & "timerange",
    options?: { presets?: DatePreset[] },
  ): ColBuilder<T, "timerange">;
  filterable(
    type: F & "checkbox",
    options?: {
      options?: Option[];
      component?: (props: Option) => JSX.Element | null;
    },
  ): ColBuilder<T, "checkbox">;
  filterable(
    type: F & "slider",
    options: { min: number; max: number; unit?: string },
  ): ColBuilder<T, "slider">;

  /**
   * Removes filtering from this column.
   *
   * After calling `.notFilterable()`, subsequent `.filterable()` calls are
   * **compile-time errors** (`F` becomes `never`).
   *
   * @example
   * col.string().label("Request ID").notFilterable().hidden()
   */
  notFilterable(): ColBuilder<T, never>;

  /**
   * Opens the filter accordion for this column by default in the filter sidebar.
   *
   * Only applies to filterable columns. Use for high-priority filters that
   * users should see immediately without expanding the sidebar manually.
   *
   * @example
   * col.enum(LEVELS).label("Level").filterable("checkbox").defaultOpen()
   */
  defaultOpen(): ColBuilder<T, F>;

  /**
   * Excludes this column from the command palette filter search.
   *
   * Useful for columns whose filter state is managed elsewhere (e.g. a date
   * picker in the toolbar) or for UI-only state fields like `cursor`.
   *
   * @example
   * col.timestamp().label("Date").filterable("timerange").commandDisabled()
   */
  commandDisabled(): ColBuilder<T, F>;

  /**
   * Hides the column by default (not shown on first render).
   *
   * Hidden columns appear in the column visibility menu and can be toggled on.
   * Use `getDefaultColumnVisibility(schema)` to derive the initial visibility map.
   *
   * @example
   * col.number().label("DNS").filterable("slider", { min: 0, max: 5000 }).hidden()
   */
  hidden(): ColBuilder<T, F>;

  /**
   * Hides the column header label in the table while keeping the column visible.
   *
   * The label is still used in the filter sidebar and other UI elements.
   *
   * @example
   * col.enum(LEVELS).label("Level").hideHeader()
   */
  hideHeader(): ColBuilder<T, F>;

  /**
   * Enables column resizing via a drag handle in the header.
   *
   * Without this, `size` locks the column to a fixed width (`minSize === size`).
   * With this, the column can be freely resized; `size` becomes the initial width only.
   *
   * @example
   * col.string().label("Host").size(125).resizable()
   */
  resizable(): ColBuilder<T, F>;

  /**
   * Sets a fixed column width in pixels.
   *
   * Without `.resizable()`, both `size` and `minSize` are set to this value.
   * With `.resizable()`, only `size` is set (initial width), allowing free resizing.
   *
   * @example
   * col.enum(LEVELS).label("Level").size(27)
   * col.timestamp().label("Date").size(200)
   */
  size(px: number): ColBuilder<T, F>;

  /**
   * Enables click-to-sort on the column header.
   *
   * Renders a `DataTableColumnHeader` with ascending/descending/none sort controls.
   *
   * @example
   * col.timestamp().label("Date").sortable()
   * col.number().label("Latency").filterable("slider", { min: 0, max: 5000 }).sortable()
   */
  sortable(): ColBuilder<T, F>;

  /**
   * Marks the data field as potentially `undefined` in the row type.
   *
   * Changes `T` to `T | undefined` in the inferred schema type (`InferTableType`).
   * Use when the column field may be absent from some rows.
   *
   * @example
   * col.number().optional().label("Percentile").notFilterable().hidden()
   * col.string().optional().label("Message").notFilterable()
   */
  optional(): ColBuilder<T | undefined, F>;

  /**
   * Includes this column in the row detail drawer (`DataTableSheet`).
   *
   * Pass a `SheetConfig` to customize label, renderer, visibility condition,
   * and layout class. Calling `.sheet()` with no arguments uses defaults
   * (label from `.label()`, no custom renderer).
   *
   * @example
   * col.timestamp().label("Date").sheet()
   * col.string().label("Host").sheet({ skeletonClassName: "w-24" })
   * col.number().label("Latency").sheet({
   *   component: (row) => <>{row.latency}ms</>,
   *   skeletonClassName: "w-16",
   * })
   */
  sheet(config?: SheetConfig): ColBuilder<T, F>;

  /**
   * Marks the column as sheet-only: hidden, not filterable, and excluded
   * from the column visibility dropdown (`enableHiding: false`).
   *
   * Convenience for `.hidden().notFilterable()` + `enableHiding: false`.
   *
   * @example
   * col.record().label("Headers").sheetOnly().sheet({ ... })
   * col.string().optional().label("Message").sheetOnly().sheet({ ... })
   */
  sheetOnly(): ColBuilder<T, never>;
}

export type TableSchemaDefinition = Record<string, ColBuilder<unknown, any>>;

// Infer the data row type from a table schema definition
export type InferTableType<T extends TableSchemaDefinition> = {
  [K in keyof T]: T[K] extends ColBuilder<infer U, any> ? U : never;
};

// ── Serializable descriptors (function-free) ────────────────────────────────

export type FilterDescriptor = {
  type: FilterType;
  defaultOpen: boolean;
  commandDisabled: boolean;
  options?: Array<{ label: string; value: string | number | boolean }>;
  min?: number;
  max?: number;
};

export type SheetDescriptor = {
  label?: string;
  className?: string;
  skeletonClassName?: string;
};

/** Serializable display config — excludes the `custom` variant (contains JSX). */
export type SerializableDisplayConfig = Exclude<
  DisplayConfig,
  { type: "custom" }
>;

export type ColumnDescriptor = {
  key: string;
  label: string;
  description?: string;
  dataType: ColKind;
  enumValues?: readonly string[];
  arrayItemType?: { dataType: ColKind; enumValues?: readonly string[] };
  optional: boolean;
  hidden: boolean;
  hideHeader?: boolean;
  enableHiding?: boolean;
  sortable: boolean;
  size?: number;
  display: SerializableDisplayConfig;
  filter: FilterDescriptor | null;
  sheet: SheetDescriptor | null;
};

export type SchemaJSON = {
  columns: ColumnDescriptor[];
};

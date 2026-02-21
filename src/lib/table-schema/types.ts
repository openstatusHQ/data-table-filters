import type { JSX } from "react";
import type { DatePreset, Option } from "@/components/data-table/types";

export type ColKind =
  | "string"
  | "number"
  | "boolean"
  | "timestamp"
  | "enum"
  | "array"
  | "record";

/** The set of filter UI types. Used as the F generic on ColBuilder<T, F>. */
export type FilterType = "input" | "checkbox" | "slider" | "timerange";

export type DisplayConfig =
  | { type: "text" }
  | { type: "code" }
  | { type: "boolean" }
  | { type: "badge" }
  | { type: "timestamp" }
  | { type: "number"; unit?: string }
  | { type: "custom"; cell: (value: unknown, row: unknown) => JSX.Element | null };

export type FilterConfig = {
  type: FilterType;
  defaultOpen: boolean;
  commandDisabled: boolean;
  options?: Option[];
  component?: (props: Option) => JSX.Element | null;
  min?: number;
  max?: number;
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
  sortable: boolean;
  filter: FilterConfig | null;
  sheet: SheetConfig | null;
};

/**
 * A fluent builder for a single table column.
 *
 * `T` is the TypeScript type of the column's data value.
 * `F` is the union of filter UI types this column supports (constrained per col kind):
 *   - col.string()    → F = "input"
 *   - col.number()    → F = "input" | "slider" | "checkbox"
 *   - col.boolean()   → F = "checkbox"
 *   - col.timestamp() → F = "timerange"
 *   - col.enum()      → F = "checkbox"
 *   - col.array()     → F = "checkbox"
 *   - col.record()    → F = never  (not filterable)
 *
 * Calling `filterable(type)` with a type not in F is a compile-time error.
 */
export interface ColBuilder<T, F extends FilterType = FilterType> {
  readonly _config: ColConfig;

  label(text: string): ColBuilder<T, F>;
  description(text: string): ColBuilder<T, F>;

  display(type: "text" | "code" | "boolean" | "badge" | "timestamp"): ColBuilder<T, F>;
  display(type: "number", options?: { unit?: string }): ColBuilder<T, F>;
  display(
    type: "custom",
    options: { cell: (value: unknown, row: unknown) => JSX.Element | null },
  ): ColBuilder<T, F>;

  /**
   * Enable filtering using the column's default filter type.
   * For col.record() (F = never) this is a compile-time error.
   */
  filterable(...args: [F] extends [never] ? [never] : []): ColBuilder<T, F>;
  /**
   * Enable filtering with an explicit filter type.
   * Only filter types in F are accepted — mismatches are compile-time errors.
   */
  filterable(type: F & ("input" | "timerange")): ColBuilder<T, F>;
  filterable(
    type: F & "checkbox",
    options?: {
      options?: Option[];
      component?: (props: Option) => JSX.Element | null;
    },
  ): ColBuilder<T, F>;
  filterable(type: F & "slider", options: { min: number; max: number }): ColBuilder<T, F>;

  /** Remove filtering. Subsequent `.filterable()` calls are compile-time errors. */
  notFilterable(): ColBuilder<T, never>;
  defaultOpen(): ColBuilder<T, F>;
  commandDisabled(): ColBuilder<T, F>;
  hidden(): ColBuilder<T, F>;
  size(px: number): ColBuilder<T, F>;
  sortable(): ColBuilder<T, F>;
  optional(): ColBuilder<T | undefined, F>;
  sheet(config?: SheetConfig): ColBuilder<T, F>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TableSchemaDefinition = Record<string, ColBuilder<unknown, any>>;

// Infer the data row type from a table schema definition
export type InferTableType<T extends TableSchemaDefinition> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

export type ColumnDescriptor = {
  key: string;
  label: string;
  description?: string;
  dataType: ColKind;
  enumValues?: readonly string[];
  arrayItemType?: { dataType: ColKind; enumValues?: readonly string[] };
  optional: boolean;
  hidden: boolean;
  sortable: boolean;
  size?: number;
  /** "custom" means a developer-supplied renderer exists; not reconstructable from JSON. */
  display: { type: string; unit?: string };
  filter: FilterDescriptor | null;
  sheet: SheetDescriptor | null;
};

export type SchemaJSON = {
  columns: ColumnDescriptor[];
};

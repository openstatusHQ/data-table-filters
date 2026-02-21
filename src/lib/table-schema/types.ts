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

export type DisplayConfig =
  | { type: "text" }
  | { type: "code" }
  | { type: "boolean" }
  | { type: "badge" }
  | { type: "timestamp" }
  | { type: "number"; unit?: string }
  | { type: "custom"; cell: (value: unknown, row: unknown) => JSX.Element | null };

export type FilterConfig = {
  type: "input" | "checkbox" | "slider" | "timerange";
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

export interface ColBuilder<T> {
  readonly _config: ColConfig;

  label(text: string): ColBuilder<T>;
  description(text: string): ColBuilder<T>;

  display(type: "text" | "code" | "boolean" | "badge" | "timestamp"): ColBuilder<T>;
  display(type: "number", options?: { unit?: string }): ColBuilder<T>;
  display(
    type: "custom",
    options: { cell: (value: unknown, row: unknown) => JSX.Element | null },
  ): ColBuilder<T>;

  filterable(): ColBuilder<T>;
  filterable(type: "input" | "timerange"): ColBuilder<T>;
  filterable(
    type: "checkbox",
    options?: {
      options?: Option[];
      component?: (props: Option) => JSX.Element | null;
    },
  ): ColBuilder<T>;
  filterable(type: "slider", options: { min: number; max: number }): ColBuilder<T>;

  notFilterable(): ColBuilder<T>;
  defaultOpen(): ColBuilder<T>;
  commandDisabled(): ColBuilder<T>;
  hidden(): ColBuilder<T>;
  size(px: number): ColBuilder<T>;
  sortable(): ColBuilder<T>;
  optional(): ColBuilder<T | undefined>;
  sheet(config?: SheetConfig): ColBuilder<T>;
}

export type TableSchemaDefinition = Record<string, ColBuilder<unknown>>;

// ── Serializable descriptors (function-free) ────────────────────────────────

export type FilterDescriptor = {
  type: "input" | "checkbox" | "slider" | "timerange";
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

// Infer the data row type from a table schema definition
export type InferTableType<T extends TableSchemaDefinition> = {
  [K in keyof T]: T[K] extends ColBuilder<infer U> ? U : never;
};

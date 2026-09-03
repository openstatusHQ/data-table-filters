import type {
  ColBuilder,
  ColKind,
  FilterType,
  TableSchemaDefinition,
} from "../table-schema/types";

export type { ColKind, FilterType };

/** The member type of a checkbox filter: the item type for an array column. */
type FilterItem<T> =
  NonNullable<T> extends readonly (infer U)[] ? U : NonNullable<T>;

/**
 * The value one column's filter accepts, from its `ColBuilder<T, F>`.
 *
 * Mirrors `normalize`: dispatch is on the declared filter type, and the
 * member type comes from the column's data type — so a checkbox on
 * `col.enum(LEVELS)` only accepts members of `LEVELS`. Distributes over `F`,
 * so a column whose filter type was never narrowed (`col.number()` allows
 * three) accepts any of them.
 */
export type FilterValueFor<T, F extends FilterType> = F extends "input"
  ? NonNullable<T> extends number
    ? number
    : string
  : F extends "checkbox"
    ? FilterItem<T> | readonly FilterItem<T>[]
    : F extends "slider"
      ? number | readonly [number, number]
      : F extends "timerange"
        ? Date | readonly [Date, Date]
        : never;

/**
 * The filter values a table schema accepts, keyed by filterable column.
 *
 * Columns that are `.notFilterable()` (or `col.record()` / `col.select()`,
 * which never are) are absent, so a key typo or a guard on an unfilterable
 * column is a compile error — the same rule `defineActions` enforces at
 * runtime for a `when` clause.
 */
export type FilterValues<TSchema extends TableSchemaDefinition> = {
  [K in keyof TSchema as TSchema[K] extends ColBuilder<unknown, infer F>
    ? [F] extends [never]
      ? never
      : K
    : never]: TSchema[K] extends ColBuilder<infer T, infer F>
    ? FilterValueFor<T, F>
    : never;
};

/** A value a filter can compare against. */
export type Scalar = string | number | boolean;

/**
 * A column's declared filter semantics, flattened to plain data.
 *
 * This is the whole input to the normalization table. Backends never see
 * anything else about a column, which is what stops them re-deriving semantics
 * from the runtime shape of a value.
 */
export type FilterSpec = {
  /** Dot-notation — the ONE identity space, matching the table schema key. */
  key: string;
  type: FilterType;
  kind: ColKind;
  /** Present when `kind === "array"`. */
  itemKind?: ColKind;
  options?: readonly Scalar[];
  min?: number;
  max?: number;
};

/**
 * The canonical, backend-neutral operation set.
 *
 * CLOSED union — exactly six members. Every backend implements all six with an
 * exhaustive switch and no default branch, so adding a seventh is a compile
 * error at every backend rather than a silent fallthrough. That is the point of
 * the design, not a defect: a new op is a breaking change to every engine.
 */
export type FilterOp =
  /** Case-insensitive substring match. */
  | { op: "substring"; key: string; value: string }
  | { op: "equals"; key: string; value: Scalar }
  /** Scalar column, value ∈ set. */
  | { op: "oneOf"; key: string; values: Scalar[] }
  /** Array column, column ∩ set ≠ ∅. */
  | { op: "overlaps"; key: string; values: Scalar[] }
  /** Inclusive on both ends. */
  | { op: "numberRange"; key: string; min: number; max: number }
  /** Inclusive on both ends. */
  | { op: "dateRange"; key: string; from: Date; to: Date };

/** Restrict which keys `plan` / `matches` consider. */
export type FilterSelection = {
  only?: readonly string[];
  exclude?: readonly string[];
};

import type {
  FilterOp,
  Filters,
  FilterSelection,
} from "@dtf/registry/lib/filters";
import {
  and,
  between,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  sql,
  type Column,
  type SQL,
} from "drizzle-orm";
import type { ColumnMapping } from "./types";

/**
 * Compile one canonical op to SQL.
 *
 * Exhaustive over the six `FilterOp` members with no default branch. The op
 * union is closed precisely so that adding a seventh fails to compile here
 * instead of silently matching nothing.
 *
 * Nothing in this function inspects the shape of a filter *value* — it only
 * ever sees an op that the declared semantics already chose. That is why a
 * numeric checkbox can no longer compile to `BETWEEN`.
 */
function toSQL(op: FilterOp, column: Column): SQL {
  switch (op.op) {
    case "substring":
      // Case-insensitive, matching the in-memory engine.
      // NOTE: LIKE metacharacters in the value are deliberately not escaped —
      // see `sql-injection.test.ts`, which pins this as safe-but-broadening.
      return ilike(column, `%${op.value}%`);

    case "equals":
      return eq(column, op.value);

    case "oneOf":
      return inArray(column, op.values);

    case "overlaps":
      // Postgres array overlap. The column is a set on both sides.
      return sql`${column} && ARRAY[${sql.join(
        op.values.map((value) => sql`${value}`),
        sql`, `,
      )}]::text[]`;

    case "numberRange":
      return between(column, op.min, op.max);

    case "dateRange":
      return and(gte(column, op.from), lte(column, op.to))!;
  }
}

/**
 * Build WHERE conditions from declared filter semantics and a column mapping.
 *
 * @param filters - The declared semantics, from `defineFilters(...)`
 * @param values  - Current filter values from parsed search params
 * @param mapping - Maps filter keys to Drizzle columns
 * @param selection - `{ only, exclude }` to limit keys (for the three-pass strategy)
 */
export function buildWhereConditions(
  filters: Filters,
  values: Record<string, unknown>,
  mapping: ColumnMapping,
  selection?: FilterSelection,
): SQL[] {
  const conditions: SQL[] = [];
  for (const op of filters.plan(values, selection)) {
    const column = mapping[op.key];
    if (!column) continue;
    conditions.push(toSQL(op, column));
  }
  return conditions;
}

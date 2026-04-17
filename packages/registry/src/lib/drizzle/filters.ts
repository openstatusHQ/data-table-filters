import { endOfDay, startOfDay } from "date-fns";
import {
  and,
  between,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  sql,
  type SQL,
} from "drizzle-orm";
import type { ColumnMapping } from "./types";

/**
 * Build WHERE conditions from filter state and a column mapping.
 *
 * Dispatches by filter value shape:
 * - string → ilike (text search)
 * - number → eq
 * - Date[] → date range (gte/lte or same-day)
 * - number[] → between (slider range) or inArray (checkbox with numbers)
 * - string[] → inArray (checkbox with strings)
 *
 * @param mapping - Maps filter keys to Drizzle columns
 * @param filters - Current filter values from parsed search params
 * @param options - { exclude, only } to skip/limit keys (for three-pass strategy)
 */
export function buildWhereConditions(
  mapping: ColumnMapping,
  filters: Record<string, unknown>,
  options?: { exclude?: string[]; only?: string[] },
): SQL[] {
  const conditions: SQL[] = [];

  for (const [key, value] of Object.entries(filters)) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (options?.exclude?.includes(key)) continue;
    if (options?.only && !options.only.includes(key)) continue;

    const column = mapping[key];
    if (!column) continue;

    // String → text search (ilike)
    if (typeof value === "string") {
      conditions.push(ilike(column, `%${value}%`));
      continue;
    }

    // Number → exact match
    if (typeof value === "number") {
      conditions.push(eq(column, value));
      continue;
    }

    // Boolean → exact match
    if (typeof value === "boolean") {
      conditions.push(eq(column, value));
      continue;
    }

    // Array handling
    if (Array.isArray(value)) {
      // Date array → date range
      if (value[0] instanceof Date) {
        const dates = value as Date[];
        if (dates.length === 1) {
          conditions.push(
            and(
              gte(column, startOfDay(dates[0])),
              lte(column, endOfDay(dates[0])),
            )!,
          );
        } else if (dates.length === 2) {
          conditions.push(and(gte(column, dates[0]), lte(column, dates[1]))!);
        }
        continue;
      }

      // Number array → slider range or checkbox
      if (typeof value[0] === "number") {
        const nums = value as number[];
        if (nums.length === 1) {
          conditions.push(eq(column, nums[0]));
        } else if (nums.length === 2) {
          conditions.push(between(column, nums[0], nums[1]));
        } else {
          conditions.push(inArray(column, nums));
        }
        continue;
      }

      // String array → checkbox (inArray) or pg array overlap
      if (typeof value[0] === "string") {
        const strs = value as string[];
        if (column.dataType === "array") {
          conditions.push(
            sql`${column} && ARRAY[${sql.join(
              strs.map((s) => sql`${s}`),
              sql`, `,
            )}]::text[]`,
          );
        } else {
          conditions.push(inArray(column, strs));
        }
        continue;
      }
    }
  }

  return conditions;
}

import { asc, desc, type SQL } from "drizzle-orm";
import type { ColumnMapping, SortDescriptor } from "./types";

/**
 * Build an ORDER BY clause from a sort descriptor.
 * Returns undefined if no sort is specified or the column isn't mapped.
 */
export function buildOrderBy(
  mapping: ColumnMapping,
  sort: SortDescriptor,
): SQL | undefined {
  if (!sort) return undefined;

  const column = mapping[sort.id];
  if (!column) return undefined;

  return sort.desc ? desc(column) : asc(column);
}

import { asc, desc, gt, lt, type SQL } from "drizzle-orm";
import type { CursorPaginationParams } from "./types";

/**
 * Build cursor-based pagination conditions and ordering.
 *
 * - direction "next": fetch rows BEFORE cursor (older) → ORDER BY cursorCol DESC
 * - direction "prev": fetch rows AFTER cursor (newer) → ORDER BY cursorCol ASC
 *
 * `tiebreakOrderBy` follows the cursor's direction rather than being fixed, so
 * that a "prev" page — fetched ascending and reversed in the handler — ends up
 * in the same total order as the "next" pages around it.
 */
export function buildCursorPagination(params: CursorPaginationParams): {
  cursorCondition: SQL | undefined;
  orderBy: SQL;
  tiebreakOrderBy: SQL | undefined;
  needsReverse: boolean;
} {
  const { cursor, direction, cursorColumn, tiebreakColumn } = params;

  const cursorValue =
    cursor instanceof Date
      ? cursor
      : cursor != null
        ? new Date(cursor)
        : new Date();

  if (direction === "prev") {
    return {
      cursorCondition: gt(cursorColumn, cursorValue),
      orderBy: asc(cursorColumn),
      tiebreakOrderBy: tiebreakColumn ? asc(tiebreakColumn) : undefined,
      needsReverse: true,
    };
  }

  return {
    cursorCondition: lt(cursorColumn, cursorValue),
    orderBy: desc(cursorColumn),
    tiebreakOrderBy: tiebreakColumn ? desc(tiebreakColumn) : undefined,
    needsReverse: false,
  };
}

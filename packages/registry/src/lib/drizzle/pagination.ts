import { asc, desc, gt, lt, type SQL } from "drizzle-orm";
import type { CursorPaginationParams } from "./types";

/**
 * Build cursor-based pagination conditions and ordering.
 *
 * - direction "next": fetch rows BEFORE cursor (older) → ORDER BY cursorCol DESC
 * - direction "prev": fetch rows AFTER cursor (newer) → ORDER BY cursorCol ASC
 */
export function buildCursorPagination(params: CursorPaginationParams): {
  cursorCondition: SQL | undefined;
  orderBy: SQL;
  needsReverse: boolean;
} {
  const { cursor, direction, cursorColumn } = params;

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
      needsReverse: true,
    };
  }

  return {
    cursorCondition: lt(cursorColumn, cursorValue),
    orderBy: desc(cursorColumn),
    needsReverse: false,
  };
}

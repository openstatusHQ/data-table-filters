import type { Column, SQL } from "drizzle-orm";
import type { PgDatabase, PgTable } from "drizzle-orm/pg-core";

/**
 * Maps tableSchema field keys to Drizzle table columns.
 * This is the bridge between your table UI schema and your database.
 *
 * @example
 * const columnMapping = {
 *   level: logs.level,
 *   date: logs.date,
 *   latency: logs.latency,
 *   "timing.dns": logs.timingDns,
 * } satisfies ColumnMapping;
 */
export type ColumnMapping = Record<string, Column>;

export type DrizzleDB = PgDatabase<any, any, any>;

/** Sort descriptor matching the URL state shape. */
export type SortDescriptor = { id: string; desc: boolean } | null;

/** Cursor-based pagination params. */
export type CursorPaginationParams = {
  cursor: Date | number | null;
  direction: "prev" | "next";
  size: number;
  cursorColumn: Column;
  /**
   * Unique column ordered last, so rows sharing a cursor value have one
   * defined order instead of whatever the plan happens to produce.
   */
  tiebreakColumn?: Column;
};

/**
 * Everything a caller needs to write its own aggregate SQL against the same
 * filtered set the handler queried.
 *
 * The three things such a caller actually needs — the resolved time range, the
 * bucket size, and the composed WHERE — are all computed inside the handler
 * already. Handing back only `SQL[]` meant every caller re-derived them.
 */
export type DrizzleQueryScope = {
  readonly db: DrizzleDB;
  readonly table: PgTable;
  readonly columns: ColumnMapping;
  /** The fully filtered set. */
  readonly where: SQL | undefined;
  /** The set slider bounds are computed over (date + non-slider filters). */
  readonly whereWithoutSliders: SQL | undefined;
  /** Resolved from an explicit date filter, else from MIN/MAX of the set. */
  readonly range: { from: Date; to: Date } | null;
  /** Bucket size for `range`, with the interval ladder already applied. */
  readonly bucketMs: number;
};

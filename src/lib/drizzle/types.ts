import type { Column } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DrizzleDB = PgDatabase<any, any, any>;

/** Sort descriptor matching the URL state shape. */
export type SortDescriptor = { id: string; desc: boolean } | null;

/** Cursor-based pagination params. */
export type CursorPaginationParams = {
  cursor: Date | number | null;
  direction: "prev" | "next";
  size: number;
  cursorColumn: Column;
};

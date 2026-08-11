import { columnMapping } from "@/app/drizzle/column-mapping";
import { logs } from "@/db/drizzle/schema";
import { seedRows } from "@/db/drizzle/seed-data";
import type { ColumnMapping } from "@dtf/registry/lib/drizzle/types";
import { defineFilters, type FilterSpec } from "@dtf/registry/lib/filters";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";

export const hasDatabase = !!process.env.DATABASE_URL;

export { seedRows };

/**
 * The filter declarations of `apps/web/src/app/infinite/table-schema.tsx`,
 * restated as plain specs.
 *
 * The real schema lives in a `.tsx` file that cannot be imported here, which
 * is the same constraint that used to force `createDrizzleHandler` to accept
 * three loose `string[]`s. Declaration order matters: `deriveKeys` walks
 * `filters.specs` in order, so this list also pins the derived key ordering
 * the handler exposes.
 */
export const testSpecs: readonly FilterSpec[] = [
  { key: "level", type: "checkbox", kind: "enum" },
  { key: "date", type: "timerange", kind: "timestamp" },
  { key: "status", type: "checkbox", kind: "number" },
  { key: "method", type: "checkbox", kind: "enum" },
  { key: "host", type: "input", kind: "string" },
  { key: "pathname", type: "input", kind: "string" },
  { key: "latency", type: "slider", kind: "number", min: 0, max: 5000 },
  { key: "regions", type: "checkbox", kind: "array", itemKind: "enum" },
  { key: "timing.dns", type: "slider", kind: "number", min: 0, max: 5000 },
  {
    key: "timing.connection",
    type: "slider",
    kind: "number",
    min: 0,
    max: 5000,
  },
  { key: "timing.tls", type: "slider", kind: "number", min: 0, max: 5000 },
  { key: "timing.ttfb", type: "slider", kind: "number", min: 0, max: 5000 },
  { key: "timing.transfer", type: "slider", kind: "number", min: 0, max: 5000 },
];

/** The one interpretation of the table's filter semantics, for every suite. */
export const testFilters = defineFilters(testSpecs);

let db: NodePgDatabase;

/**
 * The PRODUCTION column mapping, imported rather than restated.
 *
 * This used to be a hand-copied seventh mapping that had already drifted from
 * the real one (it added `message`). A mapping that is never exercised by a
 * test is exactly where an unmapped key hides, so the tests now run against
 * the same object the app does.
 */
export const testMapping: ColumnMapping = columnMapping;

export function getDb() {
  return db;
}

export function getTable() {
  return logs;
}

export async function setupTestDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is required for integration tests. " +
        "Set it to a Postgres connection string (runs automatically in CI).",
    );
  }

  db = drizzle(connectionString);
}

export async function destroyTestDb() {
  // node-postgres with drizzle manages its own pool; no manual cleanup needed
}

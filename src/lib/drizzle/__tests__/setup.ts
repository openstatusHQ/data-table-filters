import { logs } from "@/db/drizzle/schema";
import { seedRows } from "@/db/drizzle/seed-data";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import type { ColumnMapping } from "../types";

export const hasDatabase = !!process.env.DATABASE_URL;

export { seedRows };

let db: NodePgDatabase;

/** Column mapping used across all tests — mirrors the real app's mapping. */
export const testMapping: ColumnMapping = {
  level: logs.level,
  method: logs.method,
  host: logs.host,
  pathname: logs.pathname,
  status: logs.status,
  latency: logs.latency,
  regions: logs.regions,
  date: logs.date,
  "timing.dns": logs.timingDns,
  "timing.connection": logs.timingConnection,
  "timing.tls": logs.timingTls,
  "timing.ttfb": logs.timingTtfb,
  "timing.transfer": logs.timingTransfer,
  message: logs.message,
};

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

import { logs } from "@/db/drizzle/schema";
import { seedRows } from "@/db/drizzle/seed-data";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { ColumnMapping } from "../types";

export const hasDatabase = !!process.env.DATABASE_URL;

export { seedRows };

let client: ReturnType<typeof postgres>;
let db: PostgresJsDatabase;

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

  client = postgres(connectionString);
  db = drizzle(client);
}

export async function destroyTestDb() {
  if (client) await client.end();
}

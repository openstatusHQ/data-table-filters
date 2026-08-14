import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";

/**
 * A real Postgres, compiled to WASM, with no server to provision.
 *
 * The SQL engine used to be testable only against a hosted Postgres, so the
 * pre-commit hook's `DATABASE_URL= pnpm turbo test` guaranteed it was
 * *unexercised* on every commit — the one engine whose behaviour cannot be
 * predicted by reading the TypeScript was the one never run. PGLite closes
 * that gap: `ilike`, `between`, `inArray`, `&&`, `unnest` and `date_bin` are
 * the actual Postgres implementations, so these suites are ungated.
 *
 * This is tier 1. The node-postgres suites in `apps/web` remain tier 2 — they
 * still run against a real server in CI, because PGLite is one build of
 * Postgres with one collation and cannot speak for every deployment.
 */
export type PgliteDb = PgliteDatabase<Record<string, never>>;

/** A fresh in-memory database. Every call is fully isolated. */
export function createPgliteDb(): PgliteDb {
  return drizzle(new PGlite());
}

/**
 * PGLite's default collation, for tests that assert on collation-sensitive
 * behaviour. `ILIKE` case-folds through `lower()`, which is `LC_CTYPE`-driven,
 * so this is the fact that decides whether a non-ASCII substring match agrees
 * with JavaScript's `toLowerCase()`.
 */
export async function getCollation(
  db: PgliteDb,
): Promise<{ collate: string; ctype: string }> {
  const result = await db.execute<{ collate: string; ctype: string }>(
    sql`SELECT datcollate AS collate, datctype AS ctype
        FROM pg_database WHERE datname = current_database()`,
  );
  const row = result.rows[0]!;
  return { collate: row.collate, ctype: row.ctype };
}

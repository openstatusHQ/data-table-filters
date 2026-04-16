import { and, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildWhereConditions } from "@dtf/registry/lib/drizzle/filters";
import {
  destroyTestDb,
  getDb,
  getTable,
  hasDatabase,
  seedRows,
  setupTestDb,
  testMapping,
} from "./setup";

describe.skipIf(!hasDatabase)("SQL injection resistance", () => {
  beforeAll(async () => {
    await setupTestDb();
  }, 60_000);

  afterAll(async () => {
    await destroyTestDb();
  });

  async function queryWithFilters(filters: Record<string, unknown>) {
    const conditions = buildWhereConditions(testMapping, filters);
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    return getDb().select().from(getTable()).where(where);
  }

  async function tableExists(): Promise<boolean> {
    const raw = await getDb().execute(
      sql`SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'logs'
      ) as exists`,
    );
    const rows = Array.isArray(raw)
      ? (raw as { exists: boolean }[])
      : (raw as unknown as { rows: { exists: boolean }[] }).rows;
    const result = rows;
    return result[0]?.exists === true;
  }

  it("string filter with SQL escape attempt does not crash or drop table", async () => {
    const rows = await queryWithFilters({
      host: "'; DROP TABLE logs; --",
    });
    expect(rows.length).toBe(0);
    expect(await tableExists()).toBe(true);
  });

  it("string filter with UNION injection returns 0 rows", async () => {
    const rows = await queryWithFilters({
      host: "' UNION SELECT * FROM information_schema.tables --",
    });
    expect(rows.length).toBe(0);
  });

  it("string filter with backslash escape returns 0 rows", async () => {
    const rows = await queryWithFilters({
      host: "\\'; SELECT 1; --",
    });
    expect(rows.length).toBe(0);
  });

  it("string array with SQL in values (inArray path)", async () => {
    // Postgres rejects invalid enum values via parameterized query — safe behavior
    await expect(
      queryWithFilters({
        level: ["success", "'; DROP TABLE logs; --"],
      }),
    ).rejects.toThrow();
    expect(await tableExists()).toBe(true);
  });

  it("string array on array column with SQL injection (pg overlap path)", async () => {
    const rows = await queryWithFilters({
      regions: ["us-east-1", "'); DROP TABLE logs; --"],
    });
    // Only rows containing us-east-1, the injection string matches nothing
    const expected = seedRows.filter((r) =>
      r.regions.includes("us-east-1"),
    ).length;
    expect(rows.length).toBe(expected);
    expect(await tableExists()).toBe(true);
  });

  it("LIKE wildcards in string filter broaden results but don't escape SQL", async () => {
    const rows = await queryWithFilters({ host: "%" });
    // "%" inside ilike('%...%') matches all rows — this is LIKE behavior, not injection
    expect(rows.length).toBe(seedRows.length);
  });

  it("null byte in string filter does not cause unexpected behavior", async () => {
    // Postgres rejects null bytes in UTF8 via parameterized query — safe behavior
    await expect(
      queryWithFilters({
        host: "api\0.example.com",
      }),
    ).rejects.toThrow();
    expect(await tableExists()).toBe(true);
  });

  it("very long string does not crash", async () => {
    const rows = await queryWithFilters({
      host: "a".repeat(10_000),
    });
    expect(rows.length).toBe(0);
  });

  it("table is intact after all injection attempts", async () => {
    expect(await tableExists()).toBe(true);
    const rows = await getDb().select().from(getTable());
    expect(rows.length).toBe(seedRows.length);
  });
});

import { buildWhereConditions } from "@dtf/registry/lib/drizzle/filters";
import { and } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  destroyTestDb,
  getDb,
  getTable,
  hasDatabase,
  seedRows,
  setupTestDb,
  testFilters,
  testMapping,
} from "./setup";

/**
 * Tier 2 — the same engine against a real Postgres server, in CI only.
 *
 * The per-operator assertions that used to live here (one `it` per filter
 * kind: ilike, eq, inArray, overlap, between, date range, …) have moved to
 * `packages/registry/src/lib/drizzle/__tests__/conformance-sql.test.ts`, which
 * drives the shared corpus against PGLite and so runs on every commit rather
 * than only when `DATABASE_URL` is set. That corpus covers each operator far
 * more thoroughly than the six cases here did — and, unlike them, it walks
 * every checkbox arity, which is how `[200, 500]` compiling to
 * `BETWEEN 200 AND 500` went unnoticed.
 *
 * What stays is what the corpus deliberately does not model, because it is
 * about this function rather than about an operator: the `selection`
 * parameter, the column mapping, and conjunction across keys.
 */
describe.skipIf(!hasDatabase)("buildWhereConditions", () => {
  beforeAll(async () => {
    await setupTestDb();
  }, 60_000);

  afterAll(async () => {
    await destroyTestDb();
  });

  async function queryWithFilters(
    values: Record<string, unknown>,
    selection?: { exclude?: string[]; only?: string[] },
  ) {
    const conditions = buildWhereConditions(
      testFilters,
      values,
      testMapping,
      selection,
    );
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    return getDb().select().from(getTable()).where(where);
  }

  describe("selection", () => {
    it("exclude skips the excluded key", async () => {
      const rows = await queryWithFilters(
        { host: "api", status: [200] },
        { exclude: ["status"] },
      );
      const expected = seedRows.filter((r) => r.host.includes("api")).length;
      expect(rows.length).toBe(expected);
    });

    it("only applies the listed key", async () => {
      const rows = await queryWithFilters(
        { host: "api", status: [200] },
        { only: ["status"] },
      );
      const expected = seedRows.filter((r) => r.status === 200).length;
      expect(rows.length).toBe(expected);
    });

    it("exclude wins over only for the same key", async () => {
      // The three-pass strategy never does this, but `isSelected` gives
      // `exclude` precedence and a pass grouping that silently inverted would
      // be very hard to spot from query results.
      const rows = await queryWithFilters(
        { status: [200] },
        { only: ["status"], exclude: ["status"] },
      );
      expect(rows.length).toBe(seedRows.length);
    });
  });

  describe("column mapping", () => {
    it("drops a key with no mapped column", async () => {
      // `plan` happily emits an op for any declared key; this function is
      // where an op with no column has to be discarded rather than crash.
      const rows = await queryWithFilters({ nonexistent: "value" });
      expect(rows.length).toBe(seedRows.length);
    });

    it("drops a declared key that the mapping omits", async () => {
      const partial = { host: testMapping.host! };
      const conditions = buildWhereConditions(
        testFilters,
        { host: "api", status: [200] },
        partial,
      );
      expect(conditions.length).toBe(1);
    });
  });

  describe("conjunction", () => {
    it("ANDs every active filter across mixed operators", async () => {
      const rows = await queryWithFilters({
        host: "api",
        level: ["success"],
        latency: [0, 100],
      });
      const expected = seedRows.filter(
        (r) =>
          r.host.includes("api") &&
          r.level === "success" &&
          r.latency >= 0 &&
          r.latency <= 100,
      ).length;
      expect(rows.length).toBe(expected);
      expect(rows.length).toBeGreaterThan(0);
    });

    it("emits nothing for inactive values, so unrelated filters still apply", async () => {
      const rows = await queryWithFilters({
        host: null,
        status: undefined,
        level: [],
        latency: [0, 100],
      });
      const expected = seedRows.filter(
        (r) => r.latency >= 0 && r.latency <= 100,
      ).length;
      expect(rows.length).toBe(expected);
    });

    it("emits one condition per active filter", async () => {
      const conditions = buildWhereConditions(
        testFilters,
        { host: "api", level: ["success"], latency: [0, 100], status: null },
        testMapping,
      );
      expect(conditions.length).toBe(3);
    });
  });
});

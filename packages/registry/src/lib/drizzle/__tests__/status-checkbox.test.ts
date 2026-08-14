import { defineFilters, type FilterSpec } from "@dtf/registry/lib/filters";
import { and, sql } from "drizzle-orm";
import { integer, pgTable, text } from "drizzle-orm/pg-core";
import { beforeAll, describe, expect, it } from "vitest";
import { buildWhereConditions } from "../filters";
import type { ColumnMapping } from "../types";
import { createPgliteDb, type PgliteDb } from "./pglite";

/**
 * Regression test for the numeric-checkbox bug.
 *
 * `generators/filter-schema.ts` compiles a numeric checkbox to
 * `field.array(field.number())`, so selecting statuses 200 and 500 produced
 * the value `[200, 500]`. The old `drizzle/filters.ts` dispatched on the
 * **runtime shape** of that value, saw a two-element number array, decided it
 * was a slider range, and emitted `status BETWEEN 200 AND 500` — which matches
 * every status in the seed data.
 *
 * The old corpus exercised `status` as a scalar, a one-element array, and a
 * three-element array. Two was the only broken arity and the only one never
 * tested, which is why this shipped.
 *
 * These assertions are pinned against real Postgres (PGLite) rather than a
 * mock, because "what SQL does `BETWEEN` vs `IN` actually match" is precisely
 * the question a mock cannot answer.
 */

const logs = pgTable("logs", {
  host: text("host").notNull(),
  status: integer("status").notNull(),
  latency: integer("latency").notNull(),
});

const mapping: ColumnMapping = {
  host: logs.host,
  status: logs.status,
  latency: logs.latency,
};

/** The real seed statuses from `apps/web/src/db/drizzle/seed-data.ts`. */
const SEED_STATUSES = [200, 201, 301, 500, 404, 200, 429, 200];

/**
 * `status` as the app declares it: a checkbox over a number column. This is
 * the declaration that makes `numberRange` unreachable — dispatch is on the
 * declared `(type, kind)` pair, never on `value.length`.
 */
const specs: readonly FilterSpec[] = [
  { key: "host", type: "input", kind: "string" },
  { key: "status", type: "checkbox", kind: "number" },
  { key: "latency", type: "slider", kind: "number", min: 0, max: 5000 },
];

const filters = defineFilters(specs);

function toSql(values: Record<string, unknown>) {
  const conditions = buildWhereConditions(filters, values, mapping);
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  return { conditions, where };
}

describe("numeric checkbox never compiles to BETWEEN", () => {
  let db: PgliteDb;

  beforeAll(async () => {
    db = createPgliteDb();
    await db.execute(sql`
      CREATE TABLE logs (
        host text NOT NULL,
        status integer NOT NULL,
        latency integer NOT NULL
      )
    `);
    for (const [index, status] of SEED_STATUSES.entries()) {
      await db.execute(
        sql`INSERT INTO logs VALUES (${"api.example.com"}, ${status}, ${index * 10})`,
      );
    }
  });

  async function selectStatuses(values: Record<string, unknown>) {
    const { where } = toSql(values);
    return db.select().from(logs).where(where);
  }

  it("the seed still discriminates: BETWEEN 200 AND 500 matches all 8", async () => {
    // Guards the guard. This test file is only meaningful because every seeded
    // status falls inside [200, 500] — if someone edits the seed so that
    // `BETWEEN` and `IN` agree, the regression test above would pass against a
    // reintroduced bug. Fail loudly here instead.
    const ranged = await db.execute<{ n: number }>(
      sql`SELECT count(*)::int AS n FROM logs WHERE status BETWEEN 200 AND 500`,
    );
    expect(ranged.rows[0]!.n).toBe(SEED_STATUSES.length);
    expect(ranged.rows[0]!.n).toBe(8);
  });

  it("selecting [200, 500] returns 4 rows, not all 8", async () => {
    const rows = await selectStatuses({ status: [200, 500] });

    // Three 200s and one 500. Before the fix this returned all 8, because
    // every seeded status happens to fall inside [200, 500].
    expect(rows.length).toBe(4);
    expect(rows.map((row) => row.status).sort()).toEqual([200, 200, 200, 500]);

    // The bug's signature: 404, 429, 301 and 201 all sit inside the range and
    // must not come back.
    expect(rows.some((row) => row.status === 404)).toBe(false);
    expect(rows.some((row) => row.status === 429)).toBe(false);
    expect(rows.some((row) => row.status === 301)).toBe(false);
    expect(rows.some((row) => row.status === 201)).toBe(false);
  });

  it("emits set membership, not a range, in the generated SQL", async () => {
    const { where } = toSql({ status: [200, 500] });
    const { sql: text } = db.select().from(logs).where(where).toSQL();
    const normalized = text.toLowerCase();

    // Drizzle renders `inArray` as `in (...)`; some dialects render `= any`.
    expect(normalized).toMatch(/\bin \(|= any/);
    expect(normalized).not.toContain("between");
  });

  it("still emits BETWEEN for a slider, which is what BETWEEN is for", async () => {
    const { where } = toSql({ latency: [10, 30] });
    const { sql: text } = db.select().from(logs).where(where).toSQL();

    expect(text.toLowerCase()).toContain("between");

    const rows = await db.select().from(logs).where(where);
    expect(rows.map((row) => row.latency).sort((a, b) => a - b)).toEqual([
      10, 20, 30,
    ]);
  });

  it("is arity-independent — every checkbox arity is set membership", async () => {
    // The old engine was correct at 1 and 3+ and wrong only at 2. Walking the
    // arities is what the old corpus should have done.
    const cases: Array<{ selected: number[]; expected: number }> = [
      { selected: [200], expected: 3 },
      { selected: [200, 500], expected: 4 },
      { selected: [200, 404, 500], expected: 5 },
      { selected: [201, 429], expected: 2 },
      { selected: [301, 404, 429, 500], expected: 4 },
    ];

    for (const { selected, expected } of cases) {
      const rows = await selectStatuses({ status: selected });
      expect(
        rows.length,
        `status=[${selected.join(", ")}] should match ${expected} rows`,
      ).toBe(expected);
      expect(
        rows.every((row) => selected.includes(row.status)),
        `status=[${selected.join(", ")}] returned a row outside the set`,
      ).toBe(true);

      const { sql: text } = db
        .select()
        .from(logs)
        .where(toSql({ status: selected }).where)
        .toSQL();
      expect(text.toLowerCase()).not.toContain("between");
    }
  });

  it("plans a numeric checkbox as oneOf regardless of how many are selected", () => {
    for (const selected of [[200], [200, 500], [200, 404, 500]]) {
      expect(filters.plan({ status: selected })).toEqual([
        { op: "oneOf", key: "status", values: selected },
      ]);
    }
  });
});

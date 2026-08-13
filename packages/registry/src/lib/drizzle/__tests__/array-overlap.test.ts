import { defineFilters, type FilterSpec } from "@dtf/registry/lib/filters";
import { and, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  doublePrecision,
  integer,
  pgTable,
  text,
} from "drizzle-orm/pg-core";
import { beforeAll, describe, expect, it } from "vitest";
import { buildWhereConditions } from "../filters";
import type { ColumnMapping } from "../types";
import { createPgliteDb, type PgliteDb } from "./pglite";

/**
 * Regression test for the array-overlap cast.
 *
 * `toSQL` used to emit `ARRAY[...]::text[]` for every `overlaps` op, whatever
 * the column held. `col.array()` is generic over its item builder — its own
 * docstring offers `col.array(col.string())` alongside the enum form — so an
 * `integer[]` column with a checkbox filter is a supported declaration, and it
 * compiled to `integer[] && text[]`.
 *
 * Postgres resolves NO implicit casts for `&&`: not `integer[] && text[]`, and
 * not `integer[] && numeric[]` either. Both are `operator does not exist`. That
 * is why the cast is taken from the column rather than from the declared
 * `itemKind` — `number` cannot distinguish `integer[]` from `bigint[]` from
 * `double precision[]`, and getting it wrong is a query-time failure, not a
 * wrong answer.
 *
 * The conformance corpus cannot pin this on its own: `REACHABLE_PAIRS` keys on
 * `(ColKind, FilterType)`, so a single `text[]` column already satisfies
 * `array:checkbox` for every engine. This suite varies the thing the corpus
 * holds constant — the element type.
 */

const rows = pgTable("rows", {
  id: integer("id").primaryKey(),
  regions: text("regions").array().notNull(),
  codes: integer("codes").array().notNull(),
  huge: bigint("huge", { mode: "number" }).array().notNull(),
  ratios: doublePrecision("ratios").array().notNull(),
  flags: boolean("flags").array().notNull(),
});

const mapping: ColumnMapping = {
  regions: rows.regions,
  codes: rows.codes,
  huge: rows.huge,
  ratios: rows.ratios,
  flags: rows.flags,
};

/**
 * Every array column declares a checkbox filter, differing only in `itemKind`
 * — which is exactly the axis the old emitter ignored.
 */
const specs: readonly FilterSpec[] = [
  { key: "regions", type: "checkbox", kind: "array", itemKind: "enum" },
  { key: "codes", type: "checkbox", kind: "array", itemKind: "number" },
  { key: "huge", type: "checkbox", kind: "array", itemKind: "number" },
  { key: "ratios", type: "checkbox", kind: "array", itemKind: "number" },
  { key: "flags", type: "checkbox", kind: "array", itemKind: "boolean" },
];

const filters = defineFilters(specs);

describe("array overlap casts to the column's own type", () => {
  let db: PgliteDb;

  beforeAll(async () => {
    db = createPgliteDb();
    await db.execute(sql`
      CREATE TABLE rows (
        id integer PRIMARY KEY,
        regions text[] NOT NULL,
        codes integer[] NOT NULL,
        huge bigint[] NOT NULL,
        ratios double precision[] NOT NULL,
        flags boolean[] NOT NULL
      )
    `);
    await db.execute(sql`
      INSERT INTO rows VALUES
        (1, ARRAY['ams', 'fra'], ARRAY[200, 500], ARRAY[9007199254740991], ARRAY[1.5], ARRAY[true]),
        (2, ARRAY['gru'],        ARRAY[404],      ARRAY[1],                ARRAY[2.5], ARRAY[false])
    `);
  });

  async function select(values: Record<string, unknown>): Promise<number[]> {
    const conditions = buildWhereConditions(filters, values, mapping);
    const result = await db
      .select({ id: rows.id })
      .from(rows)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    return result.map((row) => row.id).sort((a, b) => a - b);
  }

  it("matches a text[] column", async () => {
    expect(await select({ regions: ["fra"] })).toEqual([1]);
    expect(await select({ regions: ["gru", "iad"] })).toEqual([2]);
  });

  it("matches an integer[] column instead of raising a type error", async () => {
    // `integer[] && text[]` — the shipped SQL — is 42883, not an empty result.
    expect(await select({ codes: [404] })).toEqual([2]);
    // Two members: the arity that hid the numeric-checkbox bug.
    expect(await select({ codes: [200, 404] })).toEqual([1, 2]);
    expect(await select({ codes: [418] })).toEqual([]);
  });

  it("matches a bigint[] column", async () => {
    expect(await select({ huge: [9007199254740991] })).toEqual([1]);
  });

  it("matches a double precision[] column", async () => {
    expect(await select({ ratios: [2.5] })).toEqual([2]);
  });

  it("matches a boolean[] column", async () => {
    expect(await select({ flags: [false] })).toEqual([2]);
  });

  it("casts to the column type, not to text", () => {
    const [condition] = buildWhereConditions(
      filters,
      { codes: [200] },
      mapping,
    );
    const { sql: text } = db.select().from(rows).where(condition).toSQL();

    expect(text).toContain("::integer[]");
    expect(text).not.toContain("::text[]");
  });
});

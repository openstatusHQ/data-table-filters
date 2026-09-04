import { defineFilters, type FilterSpec } from "@dtf/registry/lib/filters";
import { eq, sql } from "drizzle-orm";
import {
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { createDrizzleHandler } from "../handler";
import type { ColumnMapping } from "../types";
import { createPgliteDb, type PgliteDb } from "./pglite";

/**
 * Rows sharing a cursor value must come back in one order, every time.
 *
 * `ORDER BY date DESC` alone leaves tied rows in whatever order the plan
 * produced, and SQL makes no promise that two runs agree. In practice they
 * stop agreeing as soon as a row is written: an UPDATE writes a new tuple, and
 * once the old page has no room for it the row moves to the end of the heap
 * and a sequential scan reads it back last. That is what a row action does, so
 * acknowledging one row visibly reshuffled its whole timestamp group — the
 * group's *membership* was never wrong (the page-boundary logic refuses to
 * split a tied group), only its order.
 *
 * The fix is a unique column ordered last. It defaults to the table's
 * single-column primary key, which every table here has except the composite
 * one, and that one has to say so itself.
 *
 * PGLite is Postgres compiled to WASM, so this runs on every commit — see
 * `pglite.ts`. The heap behaviour it pins is Postgres's own, not a mock's.
 */

const rows = pgTable("tie_rows", {
  id: integer("id").primaryKey(),
  level: text("level").notNull(),
  date: timestamp("date", { withTimezone: true }).notNull(),
});

const mapping: ColumnMapping = {
  id: rows.id,
  level: rows.level,
  date: rows.date,
};

const specs: readonly FilterSpec[] = [
  { key: "level", type: "checkbox", kind: "string" },
];
const filters = defineFilters(specs);

/** Well in the past: the default cursor is `now`, and the predicate is `<`. */
const TIED = new Date("2020-01-01T10:00:00Z");

async function seed(count: number): Promise<PgliteDb> {
  const db = createPgliteDb();
  await db.execute(
    sql`CREATE TABLE tie_rows (
      id integer PRIMARY KEY,
      level text NOT NULL,
      date timestamptz NOT NULL
    )`,
  );
  await db.insert(rows).values(
    Array.from({ length: count }, (_, index) => ({
      id: index + 1,
      level: "error",
      date: TIED,
    })),
  );
  return db;
}

/**
 * Rewrite one row until it outgrows its page and Postgres relocates it. A
 * single UPDATE is not enough: while the page has free space the new tuple
 * stays in place and a scan still reads it in its original position.
 */
async function churn(db: PgliteDb, id: number) {
  for (let index = 0; index < 300; index++) {
    await db
      .update(rows)
      .set({ level: index % 2 ? "warning" : "error" })
      .where(eq(rows.id, id));
  }
}

function handlerFor(db: PgliteDb, tiebreakColumn?: string) {
  return createDrizzleHandler({
    db,
    table: rows,
    filters,
    columnMapping: mapping,
    cursorColumn: "date",
    ...(tiebreakColumn ? { tiebreakColumn } : {}),
  });
}

async function idsOf(
  handler: ReturnType<typeof handlerFor>,
  search: Record<string, unknown> = {},
) {
  const result = await handler.execute(search);
  return result.data.map((row) => row.id as number);
}

describe("cursor pagination — ties on the cursor column", () => {
  it("keeps one order across the update a row action performs", async () => {
    const db = await seed(6);
    const handler = handlerFor(db);

    const before = await idsOf(handler);
    expect(before).toEqual([6, 5, 4, 3, 2, 1]);

    await churn(db, 2);

    expect(await idsOf(handler)).toEqual(before);
  });

  it("orders ties by the primary key without being told to", async () => {
    const db = await seed(6);

    // Inserted 1..6 and read back 6..1: the tiebreak follows the cursor's
    // direction, so it cannot be the insertion order leaking through.
    expect(await idsOf(handlerFor(db))).toEqual([6, 5, 4, 3, 2, 1]);
  });

  it("gives a prev page the same total order as a next page", async () => {
    const db = await seed(6);
    const handler = handlerFor(db);

    // Fetched backwards from before the group and reversed, a prev page has to
    // agree with the forwards order — otherwise scrolling up renders the same
    // rows in a different sequence than scrolling down.
    const backwards = await idsOf(handler, {
      cursor: new Date("2019-01-01T00:00:00Z"),
      direction: "prev",
    });

    expect(backwards).toEqual(await idsOf(handler));
  });

  it("orders ties by an explicitly named column", async () => {
    const db = await seed(3);
    await db.update(rows).set({ level: "a" }).where(eq(rows.id, 3));
    await db.update(rows).set({ level: "b" }).where(eq(rows.id, 1));
    await db.update(rows).set({ level: "c" }).where(eq(rows.id, 2));

    // `level` is not unique in general — here it is, and the point is only
    // that the named column wins over the primary key.
    expect(await idsOf(handlerFor(db, "level"))).toEqual([2, 1, 3]);
  });

  it("rejects a tiebreak column that is not in the mapping", async () => {
    const db = await seed(1);

    expect(() => handlerFor(db, "nope")).toThrow(/tiebreakColumn "nope"/);
  });
});

describe("cursor pagination — tables without a single-column key", () => {
  const composite = pgTable(
    "tie_composite",
    {
      tenant: text("tenant").notNull(),
      id: integer("id").notNull(),
      date: timestamp("date", { withTimezone: true }).notNull(),
    },
    (table) => [primaryKey({ columns: [table.tenant, table.id] })],
  );

  const compositeMapping: ColumnMapping = {
    tenant: composite.tenant,
    id: composite.id,
    date: composite.date,
  };

  async function seedComposite() {
    const db = createPgliteDb();
    await db.execute(
      sql`CREATE TABLE tie_composite (
        tenant text NOT NULL,
        id integer NOT NULL,
        date timestamptz NOT NULL,
        PRIMARY KEY (tenant, id)
      )`,
    );
    await db.insert(composite).values(
      Array.from({ length: 4 }, (_, index) => ({
        tenant: "acme",
        id: index + 1,
        date: TIED,
      })),
    );
    return db;
  }

  /**
   * No column of a composite key is unique on its own, so there is nothing
   * safe to default to. The table stays on the old behaviour rather than being
   * ordered by something that does not break the tie.
   */
  it("builds a handler with no tiebreak, and takes one when named", async () => {
    const db = await seedComposite();
    const base = createDrizzleHandler({
      db,
      table: composite,
      filters: defineFilters([] as readonly FilterSpec[]),
      columnMapping: compositeMapping,
      cursorColumn: "date",
    });
    expect((await base.execute({})).data).toHaveLength(4);

    const named = createDrizzleHandler({
      db,
      table: composite,
      filters: defineFilters([] as readonly FilterSpec[]),
      columnMapping: compositeMapping,
      cursorColumn: "date",
      tiebreakColumn: "id",
    });
    expect((await named.execute({})).data.map((row) => row.id)).toEqual([
      4, 3, 2, 1,
    ]);
  });
});

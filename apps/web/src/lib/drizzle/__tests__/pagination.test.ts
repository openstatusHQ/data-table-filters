import { logs } from "@/db/drizzle/schema";
import { buildCursorPagination } from "@dtf/registry/lib/drizzle/pagination";
import { PgDialect } from "drizzle-orm/pg-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  destroyTestDb,
  getDb,
  getTable,
  hasDatabase,
  seedRows,
  setupTestDb,
} from "./setup";

/**
 * `buildCursorPagination` is pure — it only builds SQL fragments, so it needs
 * no database. These cases run in every local `pnpm test`, unlike the
 * DB-gated suite below.
 */
describe("buildCursorPagination (pure)", () => {
  const dialect = new PgDialect();
  const toQuery = (fragment: Parameters<PgDialect["sqlToQuery"]>[0]) =>
    dialect.sqlToQuery(fragment);
  /**
   * Params come back already mapped to driver values — a `timestamp` column
   * serializes its Date to an ISO string — so cursor values are asserted in
   * that form rather than as Date instances.
   */
  const paramOf = (fragment: Parameters<PgDialect["sqlToQuery"]>[0]) =>
    toQuery(fragment).params[0] as string;

  it("direction next → lt condition, desc order, no reverse", () => {
    const cursor = new Date("2025-01-15T10:00:00Z");
    const { cursorCondition, orderBy, needsReverse } = buildCursorPagination({
      cursor,
      direction: "next",
      size: 10,
      cursorColumn: logs.date,
    });

    expect(needsReverse).toBe(false);
    expect(toQuery(cursorCondition!).sql).toBe('"logs"."date" < $1');
    expect(paramOf(cursorCondition!)).toBe(cursor.toISOString());
    expect(toQuery(orderBy).sql).toBe('"logs"."date" desc');
  });

  it("no tiebreak column → no tiebreak clause", () => {
    const { tiebreakOrderBy } = buildCursorPagination({
      cursor: new Date("2025-01-15T10:00:00Z"),
      direction: "next",
      size: 10,
      cursorColumn: logs.date,
    });

    expect(tiebreakOrderBy).toBeUndefined();
  });

  /**
   * The tiebreak follows the cursor's direction rather than being pinned to
   * `desc`: a prev page is fetched ascending and reversed by the handler, so a
   * fixed direction would order tied rows one way going down and the other way
   * going up.
   */
  it("tiebreak column → ordered the same way as the cursor", () => {
    const next = buildCursorPagination({
      cursor: new Date("2025-01-15T10:00:00Z"),
      direction: "next",
      size: 10,
      cursorColumn: logs.date,
      tiebreakColumn: logs.uuid,
    });
    const prev = buildCursorPagination({
      cursor: new Date("2025-01-15T10:00:00Z"),
      direction: "prev",
      size: 10,
      cursorColumn: logs.date,
      tiebreakColumn: logs.uuid,
    });

    expect(toQuery(next.tiebreakOrderBy!).sql).toBe('"logs"."uuid" desc');
    expect(toQuery(prev.tiebreakOrderBy!).sql).toBe('"logs"."uuid" asc');
  });

  it("direction prev → gt condition, asc order, reverse", () => {
    const cursor = new Date("2025-01-15T10:00:00Z");
    const { cursorCondition, orderBy, needsReverse } = buildCursorPagination({
      cursor,
      direction: "prev",
      size: 10,
      cursorColumn: logs.date,
    });

    expect(needsReverse).toBe(true);
    expect(toQuery(cursorCondition!).sql).toBe('"logs"."date" > $1');
    expect(paramOf(cursorCondition!)).toBe(cursor.toISOString());
    expect(toQuery(orderBy).sql).toBe('"logs"."date" asc');
  });

  it("the two directions produce different condition and order fragments", () => {
    const cursor = new Date("2025-01-15T10:00:00Z");
    const next = buildCursorPagination({
      cursor,
      direction: "next",
      size: 10,
      cursorColumn: logs.date,
    });
    const prev = buildCursorPagination({
      cursor,
      direction: "prev",
      size: 10,
      cursorColumn: logs.date,
    });

    expect(toQuery(next.cursorCondition!).sql).not.toBe(
      toQuery(prev.cursorCondition!).sql,
    );
    expect(toQuery(next.orderBy).sql).not.toBe(toQuery(prev.orderBy).sql);
  });

  it("numeric epoch cursor → converted to the same instant as a Date cursor", () => {
    const cursor = new Date("2025-01-15T10:00:00Z");
    const fromEpoch = buildCursorPagination({
      cursor: cursor.getTime(),
      direction: "next",
      size: 10,
      cursorColumn: logs.date,
    });
    const fromDate = buildCursorPagination({
      cursor,
      direction: "next",
      size: 10,
      cursorColumn: logs.date,
    });

    expect(paramOf(fromEpoch.cursorCondition!)).toBe(cursor.toISOString());
    expect(paramOf(fromEpoch.cursorCondition!)).toBe(
      paramOf(fromDate.cursorCondition!),
    );
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
  ])("%s cursor → falls back to a fresh 'now' Date", (_label, cursor) => {
    const before = Date.now();
    const { cursorCondition } = buildCursorPagination({
      cursor: cursor as Date | number | null,
      direction: "next",
      size: 10,
      cursorColumn: logs.date,
    });
    const after = Date.now();

    const param = new Date(paramOf(cursorCondition!)).getTime();
    expect(param).toBeGreaterThanOrEqual(before);
    expect(param).toBeLessThanOrEqual(after);
  });

  it("a cursor condition is always produced, whatever the cursor", () => {
    for (const cursor of [null, undefined, 0, Date.now(), new Date()]) {
      const { cursorCondition } = buildCursorPagination({
        cursor: cursor as Date | number | null,
        direction: "next",
        size: 10,
        cursorColumn: logs.date,
      });
      expect(cursorCondition).toBeDefined();
    }
  });
});

describe.skipIf(!hasDatabase)("buildCursorPagination", () => {
  beforeAll(async () => {
    await setupTestDb();
  }, 60_000);

  afterAll(async () => {
    await destroyTestDb();
  });

  it("direction next → returns rows older than cursor in desc order", async () => {
    const cursorDate = seedRows[2].date; // 3 hours ago
    const { cursorCondition, orderBy, needsReverse } = buildCursorPagination({
      cursor: cursorDate,
      direction: "next",
      size: 10,
      cursorColumn: logs.date,
    });

    expect(needsReverse).toBe(false);

    const rows = await getDb()
      .select()
      .from(getTable())
      .where(cursorCondition)
      .orderBy(orderBy)
      .limit(10);

    expect(rows.every((r) => r.date < cursorDate)).toBe(true);
    const dates = rows.map((r) => r.date.getTime());
    expect(dates).toEqual([...dates].sort((a, b) => b - a));
  });

  it("direction prev → returns rows newer than cursor in asc order, needsReverse true", async () => {
    const cursorDate = seedRows[5].date; // 6 hours ago
    const { cursorCondition, orderBy, needsReverse } = buildCursorPagination({
      cursor: cursorDate,
      direction: "prev",
      size: 10,
      cursorColumn: logs.date,
    });

    expect(needsReverse).toBe(true);

    const rows = await getDb()
      .select()
      .from(getTable())
      .where(cursorCondition)
      .orderBy(orderBy)
      .limit(10);

    expect(rows.every((r) => r.date > cursorDate)).toBe(true);
    const dates = rows.map((r) => r.date.getTime());
    expect(dates).toEqual([...dates].sort((a, b) => a - b));
  });

  it("cursor null → uses current time, returns all past rows", async () => {
    const { cursorCondition, orderBy, needsReverse } = buildCursorPagination({
      cursor: null,
      direction: "next",
      size: 100,
      cursorColumn: logs.date,
    });

    expect(needsReverse).toBe(false);

    const rows = await getDb()
      .select()
      .from(getTable())
      .where(cursorCondition)
      .orderBy(orderBy)
      .limit(100);

    expect(rows.length).toBe(seedRows.length);
  });

  it("cursor as number (timestamp ms) → same as Date cursor", async () => {
    const cursorDate = seedRows[2].date;
    const cursorMs = cursorDate.getTime();

    const { cursorCondition, orderBy } = buildCursorPagination({
      cursor: cursorMs,
      direction: "next",
      size: 10,
      cursorColumn: logs.date,
    });

    const rows = await getDb()
      .select()
      .from(getTable())
      .where(cursorCondition)
      .orderBy(orderBy)
      .limit(10);

    expect(rows.every((r) => r.date < cursorDate)).toBe(true);
  });

  it("cursor as Date object → used directly", async () => {
    const cursorDate = new Date(seedRows[3].date);
    const { cursorCondition, orderBy } = buildCursorPagination({
      cursor: cursorDate,
      direction: "next",
      size: 10,
      cursorColumn: logs.date,
    });

    const rows = await getDb()
      .select()
      .from(getTable())
      .where(cursorCondition)
      .orderBy(orderBy)
      .limit(10);

    expect(rows.every((r) => r.date < cursorDate)).toBe(true);
  });
});

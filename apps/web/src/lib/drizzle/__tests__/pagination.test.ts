import { logs } from "@/db/drizzle/schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildCursorPagination } from "@dtf/registry/lib/drizzle/pagination";
import {
  destroyTestDb,
  getDb,
  getTable,
  hasDatabase,
  seedRows,
  setupTestDb,
} from "./setup";

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

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildOrderBy } from "../sorting";
import {
  destroyTestDb,
  getDb,
  getTable,
  hasDatabase,
  setupTestDb,
  testMapping,
} from "./setup";

describe.skipIf(!hasDatabase)("buildOrderBy", () => {
  beforeAll(async () => {
    await setupTestDb();
  }, 60_000);

  afterAll(async () => {
    await destroyTestDb();
  });

  it("sort desc → rows ordered descending", async () => {
    const orderBy = buildOrderBy(testMapping, { id: "latency", desc: true });
    const rows = await getDb().select().from(getTable()).orderBy(orderBy!);
    const latencies = rows.map((r) => r.latency);
    expect(latencies).toEqual([...latencies].sort((a, b) => b - a));
  });

  it("sort asc → rows ordered ascending", async () => {
    const orderBy = buildOrderBy(testMapping, { id: "latency", desc: false });
    const rows = await getDb().select().from(getTable()).orderBy(orderBy!);
    const latencies = rows.map((r) => r.latency);
    expect(latencies).toEqual([...latencies].sort((a, b) => a - b));
  });

  it("sort by date desc → rows ordered by date descending", async () => {
    const orderBy = buildOrderBy(testMapping, { id: "date", desc: true });
    const rows = await getDb().select().from(getTable()).orderBy(orderBy!);
    const dates = rows.map((r) => r.date.getTime());
    expect(dates).toEqual([...dates].sort((a, b) => b - a));
  });

  it("sort null → returns undefined", () => {
    const orderBy = buildOrderBy(testMapping, null);
    expect(orderBy).toBeUndefined();
  });

  it("unknown column → returns undefined", () => {
    const orderBy = buildOrderBy(testMapping, {
      id: "nonexistent",
      desc: true,
    });
    expect(orderBy).toBeUndefined();
  });
});

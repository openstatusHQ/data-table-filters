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
  testMapping,
} from "./setup";

describe.skipIf(!hasDatabase)("buildWhereConditions", () => {
  beforeAll(async () => {
    await setupTestDb();
  }, 60_000);

  afterAll(async () => {
    await destroyTestDb();
  });

  async function queryWithFilters(
    filters: Record<string, unknown>,
    options?: { exclude?: string[]; only?: string[] },
  ) {
    const conditions = buildWhereConditions(testMapping, filters, options);
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    return getDb().select().from(getTable()).where(where);
  }

  it("string filter → ilike on host", async () => {
    const rows = await queryWithFilters({ host: "api" });
    const expected = seedRows.filter((r) => r.host.includes("api")).length;
    expect(rows.length).toBe(expected);
    expect(rows.every((r) => r.host.includes("api"))).toBe(true);
  });

  it("number filter → eq on status", async () => {
    const rows = await queryWithFilters({ status: 200 });
    expect(rows.length).toBe(seedRows.filter((r) => r.status === 200).length);
    expect(rows.every((r) => r.status === 200)).toBe(true);
  });

  it("string array on regular column → inArray on level", async () => {
    const rows = await queryWithFilters({ level: ["success", "error"] });
    const expected = seedRows.filter(
      (r) => r.level === "success" || r.level === "error",
    ).length;
    expect(rows.length).toBe(expected);
    expect(
      rows.every((r) => r.level === "success" || r.level === "error"),
    ).toBe(true);
  });

  it("string array on array column → pg overlap on regions", async () => {
    const rows = await queryWithFilters({ regions: ["ap-south-1"] });
    const expected = seedRows.filter((r) =>
      r.regions.includes("ap-south-1"),
    ).length;
    expect(rows.length).toBe(expected);
  });

  it("number array (2 elements) → between for slider range", async () => {
    const rows = await queryWithFilters({ latency: [100, 300] });
    const expected = seedRows.filter(
      (r) => r.latency >= 100 && r.latency <= 300,
    ).length;
    expect(rows.length).toBe(expected);
    expect(rows.every((r) => r.latency >= 100 && r.latency <= 300)).toBe(true);
  });

  it("number array (3+ elements) → inArray for checkbox", async () => {
    const rows = await queryWithFilters({ status: [200, 404, 500] });
    const expected = seedRows.filter((r) =>
      [200, 404, 500].includes(r.status),
    ).length;
    expect(rows.length).toBe(expected);
  });

  it("number array (1 element) → eq", async () => {
    const rows = await queryWithFilters({ status: [404] });
    const expected = seedRows.filter((r) => r.status === 404).length;
    expect(rows.length).toBe(expected);
  });

  it("date array (2 elements) → date range", async () => {
    const from = seedRows[4].date; // 5 hours ago
    const to = seedRows[1].date; // 2 hours ago
    const rows = await queryWithFilters({ date: [from, to] });
    const expected = seedRows.filter(
      (r) => r.date >= from && r.date <= to,
    ).length;
    expect(rows.length).toBe(expected);
  });

  it("date array (1 element) → single day range", async () => {
    // All seed rows are on the same day (2025-01-15), so all should match
    const rows = await queryWithFilters({
      date: [new Date("2025-01-15T10:00:00Z")],
    });
    expect(rows.length).toBe(seedRows.length);
  });

  it("null / undefined / empty array → no conditions", async () => {
    const rows = await queryWithFilters({
      host: null,
      status: undefined,
      level: [],
    });
    expect(rows.length).toBe(seedRows.length);
  });

  it("unknown column key → no conditions", async () => {
    const rows = await queryWithFilters({ nonexistent: "value" });
    expect(rows.length).toBe(seedRows.length);
  });

  it("options.exclude → skips excluded key", async () => {
    const rows = await queryWithFilters(
      { host: "api", status: 200 },
      { exclude: ["status"] },
    );
    const expected = seedRows.filter((r) => r.host.includes("api")).length;
    expect(rows.length).toBe(expected);
  });

  it("options.only → only applies listed key", async () => {
    const rows = await queryWithFilters(
      { host: "api", status: 200 },
      { only: ["status"] },
    );
    const expected = seedRows.filter((r) => r.status === 200).length;
    expect(rows.length).toBe(expected);
  });

  it("multiple filters combined", async () => {
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
  });
});

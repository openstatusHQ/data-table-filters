import { logs } from "@/db/drizzle/schema";
import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { computeFacets } from "../facets";
import {
  destroyTestDb,
  getDb,
  getTable,
  hasDatabase,
  seedRows,
  setupTestDb,
  testMapping,
} from "./setup";

describe.skipIf(!hasDatabase)("computeFacets", () => {
  beforeAll(async () => {
    await setupTestDb();
  }, 60_000);

  afterAll(async () => {
    await destroyTestDb();
  });

  it("standard column → grouped values with correct counts", async () => {
    const result = await computeFacets(
      getDb(),
      getTable(),
      testMapping,
      [],
      ["level"],
    );

    expect(result.level).toBeDefined();

    const successCount = seedRows.filter((r) => r.level === "success").length;
    const warningCount = seedRows.filter((r) => r.level === "warning").length;
    const errorCount = seedRows.filter((r) => r.level === "error").length;

    const rowMap = Object.fromEntries(
      result.level.rows.map((r) => [r.value, r.total]),
    );
    expect(rowMap.success).toBe(successCount);
    expect(rowMap.warning).toBe(warningCount);
    expect(rowMap.error).toBe(errorCount);
    expect(result.level.total).toBe(seedRows.length);
  });

  it("slider key → returns min/max with empty rows", async () => {
    const result = await computeFacets(
      getDb(),
      getTable(),
      testMapping,
      [],
      ["latency"],
      { sliderKeys: ["latency"] },
    );

    expect(result.latency).toBeDefined();
    expect(result.latency.rows).toEqual([]);

    const latencies = seedRows.map((r) => r.latency);
    expect(result.latency.min).toBe(Math.min(...latencies));
    expect(result.latency.max).toBe(Math.max(...latencies));
    expect(result.latency.total).toBe(seedRows.length);
  });

  it("array column → unnested unique values with counts", async () => {
    const result = await computeFacets(
      getDb(),
      getTable(),
      testMapping,
      [],
      ["regions"],
    );

    expect(result.regions).toBeDefined();

    // Count expected occurrences of each region across all seed rows
    const regionCounts: Record<string, number> = {};
    for (const row of seedRows) {
      for (const region of row.regions) {
        regionCounts[region] = (regionCounts[region] ?? 0) + 1;
      }
    }

    const rowMap = Object.fromEntries(
      result.regions.rows.map((r) => [r.value, r.total]),
    );
    for (const [region, count] of Object.entries(regionCounts)) {
      expect(rowMap[region]).toBe(count);
    }
  });

  it("numeric standard column → rows + min/max", async () => {
    const result = await computeFacets(
      getDb(),
      getTable(),
      testMapping,
      [],
      ["status"],
    );

    expect(result.status).toBeDefined();
    const statuses = seedRows.map((r) => r.status);
    expect(result.status.min).toBe(Math.min(...statuses));
    expect(result.status.max).toBe(Math.max(...statuses));
    expect(result.status.total).toBe(seedRows.length);
  });

  it("multiple facet keys at once", async () => {
    const result = await computeFacets(
      getDb(),
      getTable(),
      testMapping,
      [],
      ["level", "method", "latency"],
      { sliderKeys: ["latency"] },
    );

    expect(result.level).toBeDefined();
    expect(result.method).toBeDefined();
    expect(result.latency).toBeDefined();
  });

  it("unknown column key → filtered out", async () => {
    const result = await computeFacets(
      getDb(),
      getTable(),
      testMapping,
      [],
      ["nonexistent"],
    );

    expect(result.nonexistent).toBeUndefined();
  });

  it("with baseConditions → facets reflect filtered subset", async () => {
    const conditions = [inArray(logs.level, ["error"])];
    const result = await computeFacets(
      getDb(),
      getTable(),
      testMapping,
      conditions,
      ["method"],
    );

    expect(result.method).toBeDefined();

    const errorRows = seedRows.filter((r) => r.level === "error");
    expect(result.method.total).toBe(errorRows.length);

    const methodCounts: Record<string, number> = {};
    for (const row of errorRows) {
      methodCounts[row.method] = (methodCounts[row.method] ?? 0) + 1;
    }

    const rowMap = Object.fromEntries(
      result.method.rows.map((r) => [r.value, r.total]),
    );
    for (const [method, count] of Object.entries(methodCounts)) {
      expect(rowMap[method]).toBe(count);
    }
  });
});

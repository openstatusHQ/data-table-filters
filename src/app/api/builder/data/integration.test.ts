import { describe, expect, it } from "vitest";
import { inferSchemaFromJSON } from "@/lib/table-schema/infer";
import { createTableSchema } from "@/lib/table-schema";
import {
  filterGenericData,
  sortGenericData,
  getGenericFacets,
  splitGenericData,
} from "./helpers";

// ── Integration: infer → filter → sort → facets → paginate ──────────────────

/**
 * End-to-end tests that validate the full builder pipeline:
 * raw JSON data → schema inference → filtering → sorting → facets → pagination
 */
describe("builder pipeline integration", () => {
  const RAW_DATA = [
    { timestamp: "2024-03-01T08:00:00Z", method: "GET", status: 200, latency: 45, path: "/api/users" },
    { timestamp: "2024-03-01T08:01:00Z", method: "POST", status: 201, latency: 120, path: "/api/users" },
    { timestamp: "2024-03-01T08:02:00Z", method: "GET", status: 404, latency: 30, path: "/api/orders" },
    { timestamp: "2024-03-01T08:03:00Z", method: "DELETE", status: 500, latency: 5000, path: "/api/users/1" },
    { timestamp: "2024-03-01T08:04:00Z", method: "GET", status: 200, latency: 60, path: "/api/health" },
    { timestamp: "2024-03-01T08:05:00Z", method: "PUT", status: 200, latency: 95, path: "/api/users/2" },
  ];

  function inferDefinition(data: unknown[]) {
    const schemaJson = inferSchemaFromJSON(data);
    return createTableSchema.fromJSON(schemaJson).definition;
  }

  it("infers schema and filters by checkbox (method)", () => {
    const definition = inferDefinition(RAW_DATA);
    const filtered = filterGenericData(RAW_DATA, { method: ["GET"] }, definition);

    expect(filtered).toHaveLength(3);
    expect(filtered.every((r) => r.method === "GET")).toBe(true);
  });

  it("infers schema and filters by slider (latency range)", () => {
    const definition = inferDefinition(RAW_DATA);

    // latency should be inferred as a number with slider filter
    const latencyConfig = definition.latency?._config;
    expect(latencyConfig?.kind).toBe("number");
    expect(latencyConfig?.filter?.type).toBe("slider");

    const filtered = filterGenericData(RAW_DATA, { latency: [0, 100] }, definition);
    expect(filtered).toHaveLength(4); // 45, 30, 60, 95
    expect(filtered.every((r) => (r.latency as number) <= 100)).toBe(true);
  });

  it("filters then sorts correctly", () => {
    const definition = inferDefinition(RAW_DATA);

    // Filter to GET requests only
    const filtered = filterGenericData(RAW_DATA, { method: ["GET"] }, definition);
    // Sort by latency ascending
    const sorted = sortGenericData(filtered, { id: "latency", desc: false });

    const latencies = sorted.map((r) => r.latency);
    expect(latencies).toEqual([30, 45, 60]);
  });

  it("computes facets from filtered data with min/max from full data", () => {
    const definition = inferDefinition(RAW_DATA);
    const filtered = filterGenericData(RAW_DATA, { method: ["GET"] }, definition);

    const facets = getGenericFacets(filtered, RAW_DATA, definition);

    // Method facets should only count GET (from filtered data)
    const getMethods = facets.method?.rows.filter((r) => r.value === "GET");
    expect(getMethods?.[0]?.total).toBe(3);

    // Latency min/max should be from full dataset
    expect(facets.latency?.min).toBe(30);
    expect(facets.latency?.max).toBe(5000);

    // Status facets from filtered data: only 200 and 404
    const statusValues = facets.status?.rows.map((r) => r.value);
    expect(statusValues).toContain(200);
    expect(statusValues).toContain(404);
    expect(statusValues).not.toContain(201);
    expect(statusValues).not.toContain(500);
  });

  it("full pipeline: filter → sort → paginate", () => {
    const definition = inferDefinition(RAW_DATA);

    // Filter: only GET method (checkbox filter)
    const filtered = filterGenericData(RAW_DATA, { method: ["GET"] }, definition);
    expect(filtered).toHaveLength(3); // GET rows

    // Sort: by latency descending
    const sorted = sortGenericData(filtered, { id: "latency", desc: true });
    expect(sorted.map((r) => r.latency)).toEqual([60, 45, 30]);

    // Paginate: page 1 of size 2
    const page1 = splitGenericData(sorted, 0, 2);
    expect(page1).toHaveLength(2);
    expect(page1.map((r) => r.latency)).toEqual([60, 45]);

    // Paginate: page 2
    const page2 = splitGenericData(sorted, 2, 2);
    expect(page2).toHaveLength(1);
    expect(page2[0].latency).toBe(30);
  });
});

import { inferSchemaFromJSON } from "@/lib/table-schema/infer";
import { describe, expect, it } from "vitest";
import { storeBuilderData } from "../cache";
import { POST } from "./route";
import type { BuilderDataResponse } from "./route";

const SAMPLE_DATA = [
  { method: "GET", status: 200, latency: 45, path: "/api/users" },
  { method: "POST", status: 201, latency: 120, path: "/api/users" },
  { method: "GET", status: 404, latency: 30, path: "/api/orders" },
  { method: "DELETE", status: 500, latency: 5000, path: "/api/admin" },
  { method: "GET", status: 200, latency: 60, path: "/api/health" },
];

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/builder/data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function setup() {
  const schemaJson = inferSchemaFromJSON(SAMPLE_DATA);
  const dataId = storeBuilderData(SAMPLE_DATA, schemaJson);
  return { dataId, schemaJson };
}

describe("POST /api/builder/data", () => {
  it("returns paginated data with meta", async () => {
    const { dataId } = setup();
    const res = await POST(
      makeRequest({ dataId, filters: {}, sort: null, offset: 0, size: 10 }),
    );
    expect(res.status).toBe(200);

    const json: BuilderDataResponse = await res.json();
    expect(json.data).toHaveLength(5);
    expect(json.meta.totalRowCount).toBe(5);
    expect(json.meta.filterRowCount).toBe(5);
    expect(json.nextCursor).toBeNull(); // all data fits in one page
  });

  it("applies pagination with offset and size", async () => {
    const { dataId } = setup();
    const res = await POST(
      makeRequest({ dataId, filters: {}, sort: null, offset: 0, size: 2 }),
    );
    const json: BuilderDataResponse = await res.json();
    expect(json.data).toHaveLength(2);
    expect(json.nextCursor).toBe(2); // more data available
  });

  it("returns null nextCursor on last page", async () => {
    const { dataId } = setup();
    const res = await POST(
      makeRequest({ dataId, filters: {}, sort: null, offset: 4, size: 10 }),
    );
    const json: BuilderDataResponse = await res.json();
    expect(json.data).toHaveLength(1);
    expect(json.nextCursor).toBeNull();
  });

  it("applies filters and returns filtered count", async () => {
    const { dataId } = setup();
    const res = await POST(
      makeRequest({
        dataId,
        filters: { method: ["GET"] },
        sort: null,
        offset: 0,
        size: 40,
      }),
    );
    const json: BuilderDataResponse = await res.json();
    expect(json.data).toHaveLength(3);
    expect(json.meta.filterRowCount).toBe(3);
    expect(json.meta.totalRowCount).toBe(5); // total unchanged
  });

  it("applies sorting", async () => {
    const { dataId } = setup();
    const res = await POST(
      makeRequest({
        dataId,
        filters: {},
        sort: { id: "latency", desc: true },
        offset: 0,
        size: 40,
      }),
    );
    const json: BuilderDataResponse = await res.json();
    const latencies = json.data.map((r) => r.latency);
    expect(latencies).toEqual([5000, 120, 60, 45, 30]);
  });

  it("returns facets in meta", async () => {
    const { dataId } = setup();
    const res = await POST(
      makeRequest({ dataId, filters: {}, sort: null, offset: 0, size: 40 }),
    );
    const json: BuilderDataResponse = await res.json();
    expect(json.meta.facets).toBeDefined();
    // method should have facet data
    expect(json.meta.facets.method).toBeDefined();
    expect(json.meta.facets.method.rows.length).toBeGreaterThan(0);
  });

  it("facet min/max come from full data even when filtered", async () => {
    const { dataId } = setup();
    const res = await POST(
      makeRequest({
        dataId,
        filters: { method: ["GET"] },
        sort: null,
        offset: 0,
        size: 40,
      }),
    );
    const json: BuilderDataResponse = await res.json();
    // latency min/max should be from ALL data (30..5000), not just GET rows
    expect(json.meta.facets.latency?.min).toBe(30);
    expect(json.meta.facets.latency?.max).toBe(5000);
  });

  it("returns 404 for unknown dataId", async () => {
    const res = await POST(
      makeRequest({
        dataId: "nonexistent-id",
        filters: {},
        sort: null,
        offset: 0,
        size: 10,
      }),
    );
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Dataset not found");
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new Request("http://localhost/api/builder/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("defaults offset to 0 and size to 40 when not provided", async () => {
    const { dataId } = setup();
    const res = await POST(makeRequest({ dataId, filters: {}, sort: null }));
    expect(res.status).toBe(200);
    const json: BuilderDataResponse = await res.json();
    expect(json.data).toHaveLength(5);
  });

  it("combines filter + sort + pagination", async () => {
    const { dataId } = setup();
    const res = await POST(
      makeRequest({
        dataId,
        filters: { method: ["GET"] },
        sort: { id: "latency", desc: false },
        offset: 0,
        size: 2,
      }),
    );
    const json: BuilderDataResponse = await res.json();
    expect(json.data).toHaveLength(2);
    expect(json.data.map((r) => r.latency)).toEqual([30, 45]);
    expect(json.meta.filterRowCount).toBe(3);
    expect(json.nextCursor).toBe(2);
  });
});

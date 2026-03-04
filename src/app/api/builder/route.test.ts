import { describe, expect, it } from "vitest";
import { POST, PATCH } from "./route";
import { getBuilderData } from "./cache";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/builder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makePatchRequest(body: unknown): Request {
  return new Request("http://localhost/api/builder", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const SAMPLE_DATA = [
  { name: "Alice Anderson", age: 30, active: true },
  { name: "Bob Brown", age: 25, active: false },
  { name: "Charlie Clark", age: 35, active: true },
  { name: "Diana Davis", age: 28, active: false },
  { name: "Eve Edwards", age: 32, active: true },
  { name: "Frank Fisher", age: 40, active: false },
  { name: "Grace Green", age: 22, active: true },
  { name: "Henry Hill", age: 45, active: false },
  { name: "Ivy Ingram", age: 29, active: true },
  { name: "Jack Jones", age: 33, active: false },
  { name: "Kate King", age: 27, active: true },
];

describe("POST /api/builder", () => {
  it("infers schema and returns dataId", async () => {
    const res = await POST(makeRequest({ data: SAMPLE_DATA }));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.dataId).toBeDefined();
    expect(json.schema).toBeDefined();
    expect(json.schema.columns).toBeInstanceOf(Array);
    expect(json.schema.columns.length).toBeGreaterThan(0);
  });

  it("stores data in cache accessible via dataId", async () => {
    const res = await POST(makeRequest({ data: SAMPLE_DATA }));
    const { dataId } = await res.json();

    const entry = getBuilderData(dataId);
    expect(entry).toBeDefined();
    expect(entry!.data).toEqual(SAMPLE_DATA);
  });

  it("infers correct column data types", async () => {
    const res = await POST(makeRequest({ data: SAMPLE_DATA }));
    const { schema } = await res.json();

    const nameCol = schema.columns.find((c: any) => c.key === "name");
    const ageCol = schema.columns.find((c: any) => c.key === "age");
    const activeCol = schema.columns.find((c: any) => c.key === "active");

    expect(nameCol?.dataType).toBe("string");
    expect(ageCol?.dataType).toBe("number");
    expect(activeCol?.dataType).toBe("boolean");
  });

  it("returns 400 when data is not an array", async () => {
    const res = await POST(makeRequest({ data: "not-an-array" }));
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe("data must be an array");
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new Request("http://localhost/api/builder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "invalid-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/builder", () => {
  it("updates schema for existing dataset", async () => {
    // First create a dataset
    const postRes = await POST(makeRequest({ data: SAMPLE_DATA }));
    const { dataId, schema } = await postRes.json();

    // Modify a label
    const updatedSchema = {
      ...schema,
      columns: schema.columns.map((c: any) =>
        c.key === "name" ? { ...c, label: "Full Name" } : c,
      ),
    };

    const patchRes = await PATCH(makePatchRequest({ dataId, schema: updatedSchema }));
    expect(patchRes.status).toBe(200);

    const json = await patchRes.json();
    expect(json.success).toBe(true);

    // Verify the schema was updated
    const entry = getBuilderData(dataId);
    const nameCol = entry!.schemaJson.columns.find((c) => c.key === "name");
    expect(nameCol?.label).toBe("Full Name");
  });

  it("returns 404 for unknown dataId", async () => {
    const res = await PATCH(
      makePatchRequest({ dataId: "nonexistent", schema: { columns: [] } }),
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 when dataId is missing", async () => {
    const res = await PATCH(makePatchRequest({ schema: { columns: [] } }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when schema is missing", async () => {
    const res = await PATCH(makePatchRequest({ dataId: "some-id" }));
    expect(res.status).toBe(400);
  });
});

import { describe, expect, it, vi } from "vitest";
import { createSchema, field } from "@/lib/store/schema";
import { createTableMCPHandler } from "../server";

const LEVELS = ["error", "warn", "info"] as const;
const REGIONS = ["ams", "fra"] as const;

const schema = createSchema({
  level: field.array(field.stringLiteral(LEVELS)),
  host: field.string(),
  latency: field.array(field.number()).delimiter("-"),
  regions: field.array(field.stringLiteral(REGIONS)),
  date: field.array(field.timestamp()).delimiter("-"),
});

const mockRows = [
  { id: 1, level: "error", host: "api.example.com", latency: 200 },
  { id: 2, level: "info", host: "web.example.com", latency: 50 },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockGetData = vi.fn(async (_opts: any) => ({
  rows: mockRows,
  total: 2,
  facets: {
    level: {
      rows: [
        { value: "error", total: 1 },
        { value: "info", total: 1 },
      ],
      total: 2,
    },
  },
}));

function createHandler(overrides?: { getData?: typeof mockGetData }) {
  return createTableMCPHandler({
    schema: schema.definition,
    description: "Test table",
    getData: overrides?.getData ?? mockGetData,
  });
}

function jsonRpcRequest(method: string, params?: unknown) {
  return new Request("http://localhost/api/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    }),
  });
}

async function callHandler(
  handler: ReturnType<typeof createHandler>,
  method: string,
  params?: unknown,
) {
  const res = await handler(jsonRpcRequest(method, params));
  return res.json();
}

describe("createTableMCPHandler", () => {
  describe("initialize", () => {
    it("returns server info and capabilities", async () => {
      const handler = createHandler();
      const body = await callHandler(handler, "initialize", {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "test", version: "1.0.0" },
      });
      expect(body.result.serverInfo.name).toBe("data-table");
      expect(body.result.capabilities.tools).toBeDefined();
    });

    it("uses custom name when provided", async () => {
      const handler = createTableMCPHandler({
        schema: schema.definition,
        description: "Test",
        name: "my-logs",
        getData: mockGetData,
      });
      const body = await callHandler(handler, "initialize", {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "test", version: "1.0.0" },
      });
      expect(body.result.serverInfo.name).toBe("my-logs");
    });
  });

  describe("tools/list", () => {
    it("returns query_table tool with auto-generated schema", async () => {
      const handler = createHandler();
      // Must initialize first
      await callHandler(handler, "initialize", {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "test", version: "1.0.0" },
      });
      // New handler for tools/list (stateless = fresh per request)
      const handler2 = createHandler();
      await callHandler(handler2, "initialize", {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "test", version: "1.0.0" },
      });
      const body = await callHandler(createHandler(), "tools/list");
      const tools = body.result.tools;
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe("query_table");
      expect(tools[0].description).toBe("Test table");

      // Check filter schema has the right fields
      const filterProps = tools[0].inputSchema.properties.filters.properties;
      expect(filterProps.level).toBeDefined();
      expect(filterProps.host).toBeDefined();
      expect(filterProps.latency).toBeDefined();
      expect(filterProps.regions).toBeDefined();
      expect(filterProps.date).toBeDefined();

      // Check enum values are present
      expect(filterProps.level.items.enum).toEqual(["error", "warn", "info"]);
      expect(filterProps.regions.items.enum).toEqual(["ams", "fra"]);
    });
  });

  describe("tools/call - query_table", () => {
    it("returns json format by default", async () => {
      mockGetData.mockClear();
      const handler = createHandler();
      const body = await callHandler(handler, "tools/call", {
        name: "query_table",
        arguments: { page: 1, pageSize: 10 },
      });
      const content = JSON.parse(body.result.content[0].text);
      expect(content.rows).toEqual(mockRows);
      expect(content.total).toBe(2);
      expect(content.page).toBe(1);
      expect(content.pageSize).toBe(10);
    });

    it("returns stats format with facets", async () => {
      const handler = createHandler();
      const body = await callHandler(handler, "tools/call", {
        name: "query_table",
        arguments: { format: "stats" },
      });
      const content = JSON.parse(body.result.content[0].text);
      expect(content.total).toBe(2);
      expect(content.facets.level).toBeDefined();
      expect(content.facets.level.rows).toHaveLength(2);
      // stats format should not include rows
      expect(content.rows).toBeUndefined();
    });

    it("passes filters to getData", async () => {
      mockGetData.mockClear();
      const handler = createHandler();
      await callHandler(handler, "tools/call", {
        name: "query_table",
        arguments: {
          filters: { level: ["error"], host: "api.example.com" },
        },
      });
      expect(mockGetData).toHaveBeenCalledOnce();
      const opts = mockGetData.mock.calls[0]![0]!;
      expect(opts.filters).toEqual({
        level: ["error"],
        host: "api.example.com",
      });
    });

    it("deserializes timestamp filters to Date objects", async () => {
      mockGetData.mockClear();
      const handler = createHandler();
      const ts1 = 1700000000000;
      const ts2 = 1700100000000;
      await callHandler(handler, "tools/call", {
        name: "query_table",
        arguments: {
          filters: { date: [ts1, ts2] },
        },
      });
      expect(mockGetData).toHaveBeenCalledOnce();
      const dates = mockGetData.mock.calls[0]![0]!.filters.date as Date[];
      expect(dates[0]).toBeInstanceOf(Date);
      expect(dates[0].getTime()).toBe(ts1);
      expect(dates[1]).toBeInstanceOf(Date);
      expect(dates[1].getTime()).toBe(ts2);
    });

    it("uses default page=1 and pageSize=50", async () => {
      mockGetData.mockClear();
      const handler = createHandler();
      await callHandler(handler, "tools/call", {
        name: "query_table",
        arguments: {},
      });
      const opts = mockGetData.mock.calls[0]![0]!;
      expect(opts.page).toBe(1);
      expect(opts.pageSize).toBe(50);
    });

    it("returns error when getData throws", async () => {
      const failingGetData = vi.fn(async () => {
        throw new Error("Database connection failed");
      });
      const handler = createHandler({
        getData: failingGetData as unknown as typeof mockGetData,
      });
      const body = await callHandler(handler, "tools/call", {
        name: "query_table",
        arguments: {},
      });
      expect(body.result.isError).toBe(true);
      expect(body.result.content[0].text).toContain(
        "Database connection failed",
      );
    });
  });
});

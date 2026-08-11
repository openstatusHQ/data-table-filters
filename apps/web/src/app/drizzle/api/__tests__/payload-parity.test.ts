import { columnMapping } from "@/app/drizzle/column-mapping";
import type {
  InfiniteQueryResponse,
  LogsMeta,
} from "@/app/drizzle/query-options";
import type { ColumnSchema } from "@/app/drizzle/schema";
import { NextRequest } from "next/server";
import SuperJSON from "superjson";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The REST route and the MCP route must serialize the same row the same way.
 *
 * Both used to hand-write the inverse of `columnMapping`, and the two copies
 * had already drifted: the MCP one silently dropped `headers`. Nothing in the
 * type system noticed, because each remap produced a fresh object literal whose
 * shape was inferred from itself. Both remaps are now deleted — the handler
 * projects with `columnMapping` — and this suite is what keeps them from being
 * reintroduced one route at a time.
 *
 * ## What this covers, and what it does not
 *
 * Both real route modules are invoked end to end: `GET` from `route.ts` with a
 * `NextRequest`, and the MCP `POST` with a JSON-RPC `tools/call`. Only
 * `createDrizzleHandler` is mocked, so everything downstream of the projection
 * — search-param parsing, the percentile pass, SuperJSON encoding, MCP tool
 * dispatch and JSON encoding — is the production code path.
 *
 * What it does NOT cover is the projection itself: the fixture stands in for
 * what the handler returns, so a bug inside `createDrizzleHandler` would not
 * show up here. That is covered against real Postgres, ungated, in
 * `packages/registry/src/lib/drizzle/__tests__/handler-projection.test.ts`.
 * The fixture is instead pinned to `columnMapping` by the first test below, so
 * it cannot quietly drift into testing a narrower row than the routes receive.
 */

/** Fields the routes project outside `columnMapping`, via `select:`. */
const SELECT_EXTRAS = ["uuid", "headers", "message"] as const;

const mocked = vi.hoisted(() => {
  /**
   * Rows exactly as `createDrizzleHandler` hands them over: keyed by schema
   * keys, `date` still a `Date`, `percentile` not yet computed.
   */
  const data: Record<string, unknown>[] = [
    {
      uuid: "0f7c4c3e-1a2b-4c5d-8e9f-000000000001",
      level: "success",
      method: "GET",
      host: "api.example.com",
      pathname: "/users",
      status: 200,
      latency: 50,
      regions: ["us-east-1", "eu-west-1"],
      date: new Date("2025-01-15T11:00:00.000Z"),
      headers: { "content-type": "application/json" },
      message: "OK",
      "timing.dns": 5,
      "timing.connection": 10,
      "timing.tls": 8,
      "timing.ttfb": 20,
      "timing.transfer": 7,
    },
    {
      uuid: "0f7c4c3e-1a2b-4c5d-8e9f-000000000002",
      level: "error",
      method: "POST",
      host: "cdn.example.com",
      pathname: "/assets",
      status: 500,
      latency: 900,
      regions: ["ap-south-1"],
      date: new Date("2025-01-15T10:00:00.000Z"),
      headers: { "content-type": "text/html", "x-trace": "abc" },
      // Nullable in the database, and left null: the deleted remaps rewrote
      // this to `undefined`, which JSON drops entirely. Pinning null here is
      // what makes the two payloads comparable at all.
      message: null,
      "timing.dns": 25,
      "timing.connection": 30,
      "timing.tls": 40,
      "timing.ttfb": 700,
      "timing.transfer": 105,
    },
  ];

  const result = {
    data,
    facets: {
      level: {
        rows: [
          { value: "success", total: 1 },
          { value: "error", total: 1 },
        ],
        total: 2,
      },
    },
    totalRowCount: 8,
    filterRowCount: 2,
    nextCursor: new Date("2025-01-15T10:00:00.000Z").getTime(),
    prevCursor: new Date("2025-01-15T11:00:00.000Z").getTime(),
    scope: {
      db: null,
      table: null,
      columns: {},
      where: undefined,
      whereWithoutSliders: undefined,
      // A null range short-circuits the chart query, so no database is touched.
      range: null,
      bucketMs: 1_000,
    },
  };

  // A fresh deep copy per call. The REST route mutates its rows to attach
  // `percentile`; sharing one array between the two routes would let that
  // mutation leak into the MCP payload and fake a parity that is not there.
  const execute = vi.fn(async () => structuredClone(result));

  return { data, result, execute };
});

vi.mock("@dtf/registry/lib/drizzle", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@dtf/registry/lib/drizzle")>();
  return {
    ...actual,
    createDrizzleHandler: () => ({
      sliderKeys: [],
      facetKeys: [],
      dateKeys: [],
      execute: mocked.execute,
    }),
  };
});

const { GET } = await import("../route");
const { POST } = await import("../mcp/route");

type RestPayload = InfiniteQueryResponse<ColumnSchema[], LogsMeta>;

async function fetchRest(): Promise<{ status: number; body: RestPayload }> {
  const response = await GET(
    new NextRequest("http://localhost/drizzle/api?size=40"),
  );
  const raw = (await response.json()) as string;
  return { status: response.status, body: SuperJSON.parse<RestPayload>(raw) };
}

async function fetchMcp(): Promise<{
  rows: Record<string, unknown>[];
  total: number;
}> {
  const response = await POST(
    new Request("http://localhost/drizzle/api/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "query_table", arguments: {} },
      }),
    }),
  );

  const body = (await response.json()) as {
    result: { isError?: boolean; content: { text: string }[] };
  };
  expect(body.result.isError).toBeFalsy();
  return JSON.parse(body.result.content[0].text);
}

beforeEach(() => {
  mocked.execute.mockClear();
});

describe("the fixture matches what the routes actually receive", () => {
  it("carries every key the handler projects, and no others", () => {
    // Both routes build their handler with `columnMapping` plus three extras,
    // so the projected row shape is exactly this union. If a column is added to
    // the mapping, this fails until the fixture grows with it.
    const projected = [...Object.keys(columnMapping), ...SELECT_EXTRAS].sort();

    for (const row of mocked.data) {
      expect(Object.keys(row).sort()).toEqual(projected);
    }
  });

  it("includes the keys the drifted MCP copy used to drop", () => {
    for (const row of mocked.data) {
      expect(Object.keys(row)).toContain("headers");
      expect(Object.keys(row)).toContain("message");
    }
  });
});

describe("REST and MCP payload parity", () => {
  it("both routes serve rows from the same handler", async () => {
    await fetchRest();
    await fetchMcp();
    // Guards against a broken mock making everything below vacuous.
    expect(mocked.execute).toHaveBeenCalledTimes(2);
  });

  it("returns the same rows, in the same order, keyed identically", async () => {
    const { status, body } = await fetchRest();
    const mcp = await fetchMcp();

    expect(status).toBe(200);
    expect(body.data).toHaveLength(mocked.data.length);
    expect(mcp.rows).toHaveLength(mocked.data.length);

    for (const [index, mcpRow] of mcp.rows.entries()) {
      const restRow = body.data[index] as unknown as Record<string, unknown>;

      // `percentile` is REST-only — it is computed in the REST route after the
      // handler returns, and the MCP route has no equivalent pass. See the
      // dedicated test below.
      expect(Object.keys(mcpRow).sort()).toEqual(
        Object.keys(restRow)
          .filter((key) => key !== "percentile")
          .sort(),
      );

      for (const key of Object.keys(mcpRow)) {
        if (key === "date") continue;
        expect(mcpRow[key]).toEqual(restRow[key]);
      }
    }
  });

  it("differs on `date` only — a Date over REST, an ISO string over MCP", async () => {
    const { body } = await fetchRest();
    const mcp = await fetchMcp();

    for (const [index, mcpRow] of mcp.rows.entries()) {
      const restRow = body.data[index];

      expect(restRow.date).toBeInstanceOf(Date);
      expect(typeof mcpRow.date).toBe("string");
      // The deliberate difference is the encoding, never the instant.
      expect(new Date(mcpRow.date as string).getTime()).toBe(
        restRow.date.getTime(),
      );
      const source = mocked.data[index].date as Date;
      expect(mcpRow.date).toBe(source.toISOString());
      expect(restRow.date.getTime()).toBe(source.getTime());
    }
  });

  it("carries `headers` on both — the field the MCP copy had silently dropped", async () => {
    const { body } = await fetchRest();
    const mcp = await fetchMcp();

    for (const [index, mcpRow] of mcp.rows.entries()) {
      const expected = mocked.data[index].headers;
      expect(mcpRow.headers).toEqual(expected);
      expect(body.data[index].headers).toEqual(expected);
      // Non-trivially populated, so an empty object cannot pass this.
      expect(Object.keys(mcpRow.headers as object).length).toBeGreaterThan(0);
    }
  });

  it("carries every dotted timing key on both", async () => {
    const { body } = await fetchRest();
    const mcp = await fetchMcp();

    const timingKeys = Object.keys(columnMapping).filter((key) =>
      key.startsWith("timing."),
    );
    expect(timingKeys).toHaveLength(5);

    for (const [index, mcpRow] of mcp.rows.entries()) {
      const restRow = body.data[index] as unknown as Record<string, unknown>;
      for (const key of timingKeys) {
        expect(mcpRow[key]).toBe(mocked.data[index][key]);
        expect(restRow[key]).toBe(mocked.data[index][key]);
      }
    }
  });

  it("preserves a null `message` identically on both", async () => {
    const { body } = await fetchRest();
    const mcp = await fetchMcp();

    const index = mocked.data.findIndex((row) => row.message === null);
    expect(index).toBeGreaterThanOrEqual(0);
    // Documented, not endorsed: the deleted remaps wrote `?? undefined`, which
    // JSON omits. Both routes now emit the column's value, so they agree.
    expect(mcp.rows[index].message).toBeNull();
    expect(body.data[index].message).toBeNull();
  });

  it("reports the same filtered total", async () => {
    const { body } = await fetchRest();
    const mcp = await fetchMcp();

    expect(mcp.total).toBe(body.meta.filterRowCount);
    expect(mcp.total).toBe(mocked.result.filterRowCount);
  });
});

describe("percentile is REST-only", () => {
  /**
   * A SECOND deliberate difference, beyond `date`.
   *
   * `mcp/route.ts` says "The only difference from the REST payload is that MCP
   * serializes `date` as an ISO string", but the REST route attaches
   * `percentile` in a pass the MCP route does not run, so MCP rows still lack
   * the field the drift note calls out. This test pins the behaviour as it is;
   * whether MCP should compute it too is a product decision, not a test one.
   */
  it("REST attaches a percentile per row; MCP emits none", async () => {
    const { body } = await fetchRest();
    const mcp = await fetchMcp();

    for (const row of body.data) {
      expect(typeof row.percentile).toBe("number");
    }
    for (const row of mcp.rows) {
      expect(Object.keys(row)).not.toContain("percentile");
    }
  });

  it("does not leak the REST percentile pass into the MCP payload", async () => {
    // Order matters only if the two routes share row objects — which they must
    // not. REST first, then MCP.
    const { body } = await fetchRest();
    expect(body.data[0].percentile).toBeDefined();

    const mcp = await fetchMcp();
    expect(mcp.rows[0].percentile).toBeUndefined();
  });
});

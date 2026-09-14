import { parseTableManifest } from "@dtf/registry/lib/table-schema";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `GET /drizzle/api/schema` serves the table manifest.
 *
 * This is the endpoint that makes the table pointable: everything a client
 * needs to render — the schema, the row identity, what the server can compute —
 * comes back from here rather than from a TypeScript import. The assertions are
 * about the contract, not the log table's particular columns.
 *
 * `../actions` is mocked so the route can be exercised without a database.
 */

const mocked = vi.hoisted(() => ({
  enabled: { value: true },
}));

vi.mock("../actions", () => ({
  demoActionsEnabled: () => mocked.enabled.value,
  actionHandler: {
    descriptors: [
      {
        id: "acknowledge",
        label: "Acknowledge",
        scope: ["row", "bulk", "filter"],
        href: "/drizzle/api/actions/acknowledge",
      },
    ],
    annotate: (rows: unknown[]) => rows,
  },
}));

const { GET } = await import("../schema/route");

function request(headers?: Record<string, string>) {
  return new Request("http://localhost/drizzle/api/schema", { headers });
}

beforeEach(() => {
  mocked.enabled.value = true;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /drizzle/api/schema", () => {
  it("serves a manifest the client parser accepts", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);

    const manifest = parseTableManifest(await response.json(), {
      actionValidation: { selfOrigin: "http://localhost" },
    });

    expect(manifest.primaryKey).toBe("uuid");
    expect(manifest.rowLabel).toBe("{method} {pathname}");
  });

  it("declares only capabilities the endpoint implements", async () => {
    const manifest = parseTableManifest(await (await GET(request())).json());

    expect(manifest.capabilities).toMatchObject({
      facets: true,
      totalRowCount: true,
      filterRowCount: true,
      chart: true,
      backwardPagination: true,
    });
  });

  it("carries the schema's columns, including the primary key", async () => {
    const manifest = parseTableManifest(await (await GET(request())).json());
    const keys = manifest.schema.columns.map((column) => column.key);

    expect(keys).toContain("uuid");
    expect(keys).toContain("level");
    expect(keys).toContain("date");
  });

  it("carries a default sort that resolves against the schema", async () => {
    const manifest = parseTableManifest(await (await GET(request())).json());
    const keys = manifest.schema.columns.map((column) => column.key);

    expect(manifest.defaults?.sort).toEqual({ id: "date", desc: true });
    expect(keys).toContain(manifest.defaults!.sort!.id);
  });

  it("describes the chart it actually serves", async () => {
    const manifest = parseTableManifest(await (await GET(request())).json());
    const keys = manifest.schema.columns.map((column) => column.key);

    expect(manifest.capabilities.chart).toBe(true);
    // The bucketing column has to exist, or the chart is pinned to nothing.
    expect(keys).toContain(manifest.chart!.columnKey);
    expect(manifest.chart!.series.map((s) => s.key)).toEqual([
      "success",
      "warning",
      "error",
    ]);
  });

  it("advertises actions only while they are enabled", async () => {
    const on = parseTableManifest(await (await GET(request())).json(), {
      actionValidation: { selfOrigin: "http://localhost" },
    });
    expect(on.capabilities.actions).toBe(true);
    expect(on.actions?.map((action) => action.id)).toEqual(["acknowledge"]);

    mocked.enabled.value = false;
    const off = parseTableManifest(await (await GET(request())).json());
    expect(off.capabilities.actions).toBe(false);
    expect(off.actions).toBeUndefined();
  });

  it("answers 304 when the client already has the current manifest", async () => {
    const first = await GET(request());
    const etag = first.headers.get("etag");
    expect(etag).toBeTruthy();

    const second = await GET(request({ "if-none-match": etag! }));
    expect(second.status).toBe(304);
  });

  it("changes its ETag when the manifest changes", async () => {
    const withActions = (await GET(request())).headers.get("etag");
    mocked.enabled.value = false;
    const without = (await GET(request())).headers.get("etag");

    expect(withActions).not.toBe(without);
  });
});

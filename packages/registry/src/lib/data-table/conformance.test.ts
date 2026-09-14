import {
  col,
  createTableManifest,
  createTableSchema,
  type TableCapabilities,
  type TableManifest,
} from "@dtf/registry/lib/table-schema";
import { describe, expect, it } from "vitest";
import {
  formatConformanceReport,
  runEndpointConformance,
  type ConformanceReport,
} from "./conformance";

const tableSchema = createTableSchema({
  uuid: col.string().label("ID"),
  level: col.enum(["error", "info"]).label("Level").filterable("checkbox"),
  host: col.string().label("Host"),
});

function manifest(capabilities?: Partial<TableCapabilities>): TableManifest {
  return createTableManifest({
    schema: tableSchema,
    primaryKey: "uuid",
    capabilities,
  });
}

type Row = Record<string, unknown>;

/**
 * A compliant fake endpoint. Each test breaks exactly one thing about it, so a
 * failing check is attributable to that one deviation.
 */
function endpoint(config?: {
  rows?: (params: URLSearchParams) => Row[];
  facets?: Record<string, unknown>;
  meta?: Record<string, unknown>;
  nextCursor?: unknown;
  prevCursor?: unknown;
  status?: (params: URLSearchParams) => number | null;
  body?: (params: URLSearchParams) => unknown;
}) {
  const calls: string[] = [];

  const fetchImpl = async (url: string): Promise<Response> => {
    calls.push(url);
    const params = new URLSearchParams(url.split("?")[1] ?? "");

    const status = config?.status?.(params);
    if (status) {
      return new Response("nope", { status, statusText: "Boom" });
    }

    if (config?.body) {
      return Response.json(config.body(params));
    }

    const size = Number(params.get("size") ?? 5);
    const cursor = Number(params.get("cursor") ?? 100);
    const rows =
      config?.rows?.(params) ??
      Array.from({ length: size }, (_, i) => ({
        uuid: `id-${cursor}-${i}`,
        level: "info",
        host: "a.com",
      }));

    return Response.json({
      data: rows,
      meta: {
        totalRowCount: 100,
        filterRowCount: 100,
        chartData: [],
        facets: config?.facets ?? {
          level: { rows: [{ value: "info", total: 100 }], total: 100 },
        },
        ...config?.meta,
      },
      nextCursor:
        config?.nextCursor !== undefined ? config.nextCursor : cursor - 10,
      prevCursor:
        config?.prevCursor !== undefined ? config.prevCursor : cursor + 10,
    });
  };

  return { fetch: fetchImpl as unknown as typeof fetch, calls };
}

function check(report: ConformanceReport, id: string) {
  const found = report.checks.find((c) => c.id === id);
  if (!found) throw new Error(`no check with id ${id}`);
  return found;
}

describe("runEndpointConformance", () => {
  it("passes a compliant endpoint", async () => {
    const report = await runEndpointConformance({
      url: "https://api.example.com/logs",
      manifest: manifest({ facets: true, totalRowCount: true }),
      fetch: endpoint().fetch,
    });

    expect(
      report.checks.filter((c) => c.status === "fail"),
      formatConformanceReport(report),
    ).toEqual([]);
    expect(report.ok).toBe(true);
    expect(check(report, "responds").status).toBe("pass");
    expect(check(report, "response-shape").status).toBe("pass");
  });

  it("reports an unreachable endpoint without running the rest", async () => {
    const report = await runEndpointConformance({
      url: "https://api.example.com/logs",
      manifest: manifest(),
      fetch: (async () => {
        throw new Error("ECONNREFUSED");
      }) as unknown as typeof fetch,
    });

    expect(report.ok).toBe(false);
    expect(check(report, "responds").detail).toContain("ECONNREFUSED");
    expect(report.checks).toHaveLength(1);
  });

  it("reports a non-2xx", async () => {
    const report = await runEndpointConformance({
      url: "https://api.example.com/logs",
      manifest: manifest(),
      fetch: endpoint({ status: () => 500 }).fetch,
    });

    expect(check(report, "responds").status).toBe("fail");
    expect(check(report, "responds").detail).toContain("500");
  });

  it("reports a response that does not match the contract", async () => {
    const report = await runEndpointConformance({
      url: "https://api.example.com/logs",
      manifest: manifest(),
      fetch: endpoint({ body: () => ({ rows: [], total: 0 }) }).fetch,
    });

    expect(check(report, "response-shape").status).toBe("fail");
    expect(check(report, "response-shape").issues?.length).toBeGreaterThan(0);
  });

  it("catches an endpoint that ignores `size`", async () => {
    const report = await runEndpointConformance({
      url: "https://api.example.com/logs",
      manifest: manifest(),
      size: 5,
      fetch: endpoint({
        rows: () => Array.from({ length: 50 }, (_, i) => ({ uuid: `id-${i}` })),
      }).fetch,
    });

    expect(check(report, "size").status).toBe("fail");
    expect(check(report, "size").detail).toContain("50");
  });

  it("catches rows missing the primary key", async () => {
    const report = await runEndpointConformance({
      url: "https://api.example.com/logs",
      manifest: manifest(),
      fetch: endpoint({ rows: () => [{ level: "info" }, { level: "error" }] })
        .fetch,
    });

    expect(check(report, "primary-key").status).toBe("fail");
    expect(check(report, "primary-key").detail).toContain("uuid");
  });

  it("catches duplicate primary keys within a page", async () => {
    const report = await runEndpointConformance({
      url: "https://api.example.com/logs",
      manifest: manifest(),
      fetch: endpoint({ rows: () => [{ uuid: "a" }, { uuid: "a" }] }).fetch,
    });

    expect(check(report, "primary-key-unique").status).toBe("fail");
  });

  it("skips the row checks when the endpoint is empty", async () => {
    const report = await runEndpointConformance({
      url: "https://api.example.com/logs",
      manifest: manifest(),
      fetch: endpoint({ rows: () => [], nextCursor: null }).fetch,
    });

    expect(check(report, "primary-key").status).toBe("skip");
  });

  it("catches a declared facet the endpoint does not compute", async () => {
    const report = await runEndpointConformance({
      url: "https://api.example.com/logs",
      manifest: manifest({ facets: true }),
      fetch: endpoint({ facets: {} }).fetch,
    });

    expect(check(report, "facets").status).toBe("fail");
    expect(check(report, "facets").detail).toContain("level");
  });

  it("only requires the facets named in facetedColumns", async () => {
    const partial: TableManifest = {
      ...manifest({ facets: true }),
      capabilities: {
        ...manifest({ facets: true }).capabilities,
        facetedColumns: [],
      },
    };
    const report = await runEndpointConformance({
      url: "https://api.example.com/logs",
      manifest: partial,
      fetch: endpoint({ facets: {} }).fetch,
    });

    expect(check(report, "facets").status).toBe("pass");
  });

  it("skips the facet check when facets are not declared", async () => {
    const report = await runEndpointConformance({
      url: "https://api.example.com/logs",
      manifest: manifest({ facets: false }),
      fetch: endpoint({ facets: {} }).fetch,
    });

    expect(check(report, "facets").status).toBe("skip");
  });

  it("catches a cursor the endpoint ignores", async () => {
    // Every page identical: the classic infinite scroll that never advances.
    const report = await runEndpointConformance({
      url: "https://api.example.com/logs",
      manifest: manifest(),
      fetch: endpoint({
        rows: () => [{ uuid: "always-the-same" }],
        nextCursor: 90,
      }).fetch,
    });

    expect(check(report, "paging").status).toBe("fail");
    expect(check(report, "paging").detail).toContain("cursor");
  });

  it("passes paging when the second page differs", async () => {
    const report = await runEndpointConformance({
      url: "https://api.example.com/logs",
      manifest: manifest(),
      fetch: endpoint().fetch,
    });

    expect(check(report, "paging").status).toBe("pass");
  });

  it("skips paging when the first page is the last", async () => {
    const report = await runEndpointConformance({
      url: "https://api.example.com/logs",
      manifest: manifest(),
      fetch: endpoint({ nextCursor: null }).fetch,
    });

    expect(check(report, "paging").status).toBe("skip");
  });

  it("checks backwards paging only when declared", async () => {
    const off = await runEndpointConformance({
      url: "https://api.example.com/logs",
      manifest: manifest({ backwardPagination: false }),
      fetch: endpoint().fetch,
    });
    expect(check(off, "backward-paging").status).toBe("skip");

    const on = await runEndpointConformance({
      url: "https://api.example.com/logs",
      manifest: manifest({ backwardPagination: true }),
      fetch: endpoint().fetch,
    });
    expect(check(on, "backward-paging").status).toBe("pass");
  });

  it("catches an endpoint that rejects `direction=prev` despite declaring it", async () => {
    const report = await runEndpointConformance({
      url: "https://api.example.com/logs",
      manifest: manifest({ backwardPagination: true }),
      fetch: endpoint({
        status: (params) => (params.get("direction") === "prev" ? 400 : null),
      }).fetch,
    });

    expect(check(report, "backward-paging").status).toBe("fail");
  });

  it("catches an endpoint that 400s on an unknown parameter", async () => {
    // The table sends view-state params (`uuid`, `live`) that never narrow the
    // result set; an endpoint that rejects unknown keys breaks on them.
    const report = await runEndpointConformance({
      url: "https://api.example.com/logs",
      manifest: manifest(),
      fetch: endpoint({
        status: (params) => (params.has("__dtf_unknown_param") ? 400 : null),
      }).fetch,
    });

    expect(check(report, "unknown-param").status).toBe("fail");
  });

  it("appends its query to a URL that already has one", async () => {
    const fake = endpoint();
    await runEndpointConformance({
      url: "https://api.example.com/logs?tenant=acme",
      manifest: manifest(),
      fetch: fake.fetch,
    });

    expect(fake.calls[0]).toBe(
      "https://api.example.com/logs?tenant=acme&size=5",
    );
  });

  it("uses a custom parser", async () => {
    let parsed = 0;
    const report = await runEndpointConformance({
      url: "https://api.example.com/logs",
      manifest: manifest(),
      fetch: endpoint().fetch,
      parse: async (response) => {
        parsed++;
        return response.json();
      },
    });

    expect(parsed).toBeGreaterThan(0);
    expect(report.ok).toBe(true);
  });
});

describe("formatConformanceReport", () => {
  it("renders one line per check plus a total", async () => {
    const report = await runEndpointConformance({
      url: "https://api.example.com/logs",
      manifest: manifest({ facets: true }),
      fetch: endpoint().fetch,
    });

    const text = formatConformanceReport(report);
    expect(text).toContain("PASS  responds");
    expect(text).toContain(
      `${report.passed} passed, ${report.failed} failed, ${report.skipped} skipped`,
    );
  });

  it("includes the detail for a failing check", async () => {
    const report = await runEndpointConformance({
      url: "https://api.example.com/logs",
      manifest: manifest(),
      fetch: endpoint({ status: () => 503 }).fetch,
    });

    expect(formatConformanceReport(report)).toContain("503");
  });
});

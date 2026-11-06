import {
  runEndpointConformance,
  validateListResponse,
} from "@dtf/registry/lib/data-table";
import { parseTableManifest } from "@dtf/registry/lib/table-schema";
import { describe, expect, it } from "vitest";
import { listOrders, manifest } from "./table";

describe("orders manifest", () => {
  it("survives the validation a remote table applies to it", () => {
    const parsed = parseTableManifest(JSON.parse(JSON.stringify(manifest)));
    expect(parsed.primaryKey).toBe("order_id");
    expect(parsed.schema.columns.map((column) => column.key)).toEqual(
      manifest.schema.columns.map((column) => column.key),
    );
  });

  it("declares only what the list endpoint computes", () => {
    expect(manifest.capabilities).toMatchObject({
      facets: true,
      totalRowCount: true,
      filterRowCount: true,
      chart: false,
      backwardPagination: false,
      actions: false,
    });
  });

  it("infers a filter for every kind of column in the data", () => {
    const filters = Object.fromEntries(
      manifest.schema.columns.map((column) => [
        column.key,
        column.filter?.type ?? null,
      ]),
    );
    expect(filters).toMatchObject({
      status: "checkbox",
      price: "slider",
      ordered_at: "timerange",
    });
  });
});

describe("listOrders", () => {
  it("returns the first page with counts and facets", () => {
    const page = listOrders({});
    expect(page.data).toHaveLength(20);
    expect(page.meta.totalRowCount).toBe(100);
    expect(page.meta.filterRowCount).toBe(100);
    expect(page.nextCursor).toBe(20);
    expect(Object.keys(page.meta.facets)).toContain("status");
    expect(
      validateListResponse(page, { capabilities: manifest.capabilities }),
    ).toEqual([]);
  });

  it("pages by offset until the list ends", () => {
    const seen = new Set<unknown>();
    let cursor: number | null = 0;
    let requests = 0;
    while (cursor !== null) {
      const page = listOrders({ cursor: String(cursor), size: "30" });
      for (const row of page.data) seen.add(row.order_id);
      cursor = page.nextCursor;
      requests++;
    }
    expect(requests).toBe(4);
    expect(seen.size).toBe(100);
  });

  it("clamps the page size", () => {
    expect(listOrders({ size: "100000" }).data).toHaveLength(100);
    expect(listOrders({ size: "0" }).data).toHaveLength(1);
  });

  it("filters a checkbox column and counts the matches", () => {
    const all = listOrders({ size: "100" });
    const status = String(all.data[0].status);
    const expected = all.data.filter((row) => row.status === status).length;

    const page = listOrders({ status, size: "100" });
    expect(page.meta.filterRowCount).toBe(expected);
    expect(page.meta.totalRowCount).toBe(100);
    expect(page.data.every((row) => row.status === status)).toBe(true);
  });

  it("filters a slider range inclusively", () => {
    // Whole-number bounds that rows really sit on would be ideal, but prices
    // are decimals and the slider parses integers, so compare against the
    // rows the same inclusive range selects from the full list.
    const all = listOrders({ size: "100" }).data;
    const expected = all
      .filter((row) => {
        const price = row.price as number;
        return price >= 100 && price <= 200;
      })
      .map((row) => row.order_id)
      .sort();

    const page = listOrders({ price: "100-200", size: "100" });
    expect(page.data.map((row) => row.order_id).sort()).toEqual(expected);
    expect(expected.length).toBeGreaterThan(0);
    expect(expected.length).toBeLessThan(100);
  });

  it("filters a time range over ISO-string rows", () => {
    const all = listOrders({ size: "100" });
    const times = all.data
      .map((row) => new Date(String(row.ordered_at)).getTime())
      .sort((a, b) => a - b);
    const from = times[10];
    const to = times[19];

    const page = listOrders({ ordered_at: `${from}-${to}`, size: "100" });
    expect(page.meta.filterRowCount).toBe(10);
    expect(page.data).toHaveLength(10);
    for (const row of page.data) {
      const time = new Date(String(row.ordered_at)).getTime();
      expect(time).toBeGreaterThanOrEqual(from);
      expect(time).toBeLessThanOrEqual(to);
    }
  });

  it("sorts", () => {
    const prices = listOrders({ sort: "price.desc", size: "100" }).data.map(
      (row) => row.price as number,
    );
    expect(prices).toEqual([...prices].sort((a, b) => b - a));
  });

  it("ignores a parameter it does not know", () => {
    expect(listOrders({ __unknown: "1" }).data).toHaveLength(20);
  });
});

describe("conformance", () => {
  it("passes the kit the page runs against it", async () => {
    const report = await runEndpointConformance({
      url: "https://example.test/headless/api/orders",
      manifest,
      fetch: async (input) => {
        const url = new URL(String(input));
        return Response.json(listOrders(Object.fromEntries(url.searchParams)));
      },
    });
    expect(report.checks.filter((check) => check.status === "fail")).toEqual(
      [],
    );
    expect(report.ok).toBe(true);
  });
});

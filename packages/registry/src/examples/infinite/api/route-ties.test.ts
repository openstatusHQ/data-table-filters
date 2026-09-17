import type { InfiniteQueryResponse } from "@dtf/registry/lib/data-table";
import SuperJSON from "superjson";
import { describe, expect, it, vi } from "vitest";
import type { ColumnSchema } from "../table-schema";
import { GET } from "./route";

// Rows sharing one timestamp, which the generated data never has, to pin
// the order inside a tie: the caller's sort, then uuid descending — the
// directions `createDrizzleHandler` uses, so swapping it in changes nothing.
vi.mock("../data", () => {
  const date = new Date("2026-01-01T00:00:00Z");
  const row = (uuid: string, latency: number): ColumnSchema => ({
    uuid,
    date,
    level: "info",
    status: 200,
    method: "GET",
    pathname: "/",
    region: "ams",
    latency,
  });
  return { rows: [row("a", 30), row("b", 10), row("c", 20)] };
});

async function fetchUuids(params: Record<string, string>): Promise<string[]> {
  const url = new URL("http://localhost/example/api");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const response = await GET(new Request(url));
  const page = SuperJSON.parse<InfiniteQueryResponse<ColumnSchema[]>>(
    await response.json(),
  );
  return page.data.map((row) => row.uuid);
}

describe("example route tie order", () => {
  it("breaks a timestamp tie by uuid descending", async () => {
    expect(await fetchUuids({})).toEqual(["c", "b", "a"]);
  });

  it("applies the requested sort inside the tie", async () => {
    expect(await fetchUuids({ sort: "latency.asc" })).toEqual(["b", "c", "a"]);
    expect(await fetchUuids({ sort: "latency.desc" })).toEqual(["a", "c", "b"]);
  });

  it("keeps tied rows on one page", async () => {
    expect(await fetchUuids({ size: "1" })).toEqual(["c", "b", "a"]);
  });
});

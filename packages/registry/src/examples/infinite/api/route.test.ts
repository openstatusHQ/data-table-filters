import type { InfiniteQueryResponse } from "@dtf/registry/lib/data-table";
import SuperJSON from "superjson";
import { describe, expect, it } from "vitest";
import { rows } from "../data";
import type { ColumnSchema } from "../table-schema";
import { TIMING_PHASES } from "../timing";
import { GET } from "./route";

type Page = InfiniteQueryResponse<ColumnSchema[]>;

async function fetchPage(params: Record<string, string>): Promise<Page> {
  const url = new URL("http://localhost/example/api");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const response = await GET(new Request(url));
  return SuperJSON.parse<Page>(await response.json());
}

/** Walks `next` pages from the top, the way the table scrolls. */
async function walk(params: Record<string, string>, pages: number) {
  const seen: Page[] = [];
  let cursor: number | null = null;
  for (let index = 0; index < pages; index++) {
    const page = await fetchPage({
      ...params,
      ...(cursor === null ? {} : { cursor: String(cursor), _meta: "false" }),
    });
    seen.push(page);
    cursor = page.nextCursor as number | null;
    if (cursor === null) break;
  }
  return seen;
}

const isDescending = (rows: ColumnSchema[]) =>
  rows.every(
    (row, index) =>
      index === 0 || rows[index - 1].date.getTime() >= row.date.getTime(),
  );

const uuids = (rows: ColumnSchema[]) => rows.map((row) => row.uuid);

// The mock rows are generated newest first with no two sharing a timestamp,
// so whatever the sort, three pages must be exactly the first 120 of them —
// which catches a skipped row as well as a repeated one.
const EXPECTED_120 = uuids(rows.slice(0, 120));

describe("example route pagination", () => {
  it("serves newest first with a full page by default", async () => {
    const [page] = await walk({}, 1);
    expect(page.data).toHaveLength(40);
    expect(isDescending(page.data)).toBe(true);
    expect(page.meta.totalRowCount).toBe(5000);
  });

  it("does not repeat or skip rows across pages", async () => {
    const pages = await walk({}, 3);
    expect(uuids(pages.flatMap((page) => page.data))).toEqual(EXPECTED_120);
  });

  // Regression: sorting by ascending date (or any non-date column) used to
  // order the rows by that sort and then page them by the timestamp cursor,
  // so the second page re-read the first one forever.
  it.each(["date.asc", "latency.desc", "status.asc"])(
    "keeps the cursor consistent under sort=%s",
    async (sort) => {
      const pages = await walk({ sort }, 3);
      expect(pages).toHaveLength(3);
      expect(uuids(pages.flatMap((page) => page.data))).toEqual(EXPECTED_120);
    },
  );

  it("falls back to the default size for a non-positive size", async () => {
    const [zero] = await walk({ size: "0" }, 1);
    const [negative] = await walk({ size: "-5" }, 1);
    expect(zero.data).toHaveLength(40);
    expect(negative.data).toHaveLength(40);
    expect(zero.nextCursor).not.toBeNull();
  });

  it("reads everything newer than the cursor for prev", async () => {
    const [first] = await walk({}, 1);
    const cursor = first.data[9].date.getTime();
    const newer = await fetchPage({
      direction: "prev",
      cursor: String(cursor),
      _meta: "false",
    });
    expect(newer.data.map((row) => row.uuid)).toEqual(
      first.data.slice(0, 9).map((row) => row.uuid),
    );
  });
});

describe("timing phases", () => {
  it("adds up to the latency on every row", () => {
    for (const row of rows) {
      const sum = TIMING_PHASES.reduce((total, phase) => total + row[phase], 0);
      expect(sum).toBe(row.latency);
      for (const phase of TIMING_PHASES)
        expect(row[phase]).toBeGreaterThanOrEqual(0);
    }
  });

  it("serves a min/max facet per phase for the sliders", async () => {
    const page = await fetchPage({});
    for (const phase of TIMING_PHASES) {
      const facet = page.meta.facets?.[phase];
      expect(facet?.min).toBeGreaterThanOrEqual(0);
      expect(facet?.max).toBeGreaterThan(facet?.min ?? 0);
    }
  });

  it("filters by a phase range", async () => {
    const page = await fetchPage({ "timing.ttfb": "100-200" });
    expect(page.data.length).toBeGreaterThan(0);
    for (const row of page.data) {
      expect(row["timing.ttfb"]).toBeGreaterThanOrEqual(100);
      expect(row["timing.ttfb"]).toBeLessThanOrEqual(200);
    }
  });
});

import type { InfiniteQueryResponse } from "@dtf/registry/lib/data-table";
import SuperJSON from "superjson";
import { describe, expect, it } from "vitest";
import type { ColumnSchema } from "../table-schema";
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

describe("example route pagination", () => {
  it("serves newest first with a full page by default", async () => {
    const [page] = await walk({}, 1);
    expect(page.data).toHaveLength(40);
    expect(isDescending(page.data)).toBe(true);
    expect(page.meta.totalRowCount).toBe(5000);
  });

  it("does not repeat or skip rows across pages", async () => {
    const pages = await walk({}, 3);
    const uuids = pages.flatMap((page) => page.data.map((row) => row.uuid));
    expect(new Set(uuids).size).toBe(uuids.length);
    expect(isDescending(pages.flatMap((page) => page.data))).toBe(true);
  });

  // Regression: sorting by ascending date (or any non-date column) used to
  // order the rows by that sort and then page them by the timestamp cursor,
  // so the second page re-read the first one forever.
  it.each(["date.asc", "latency.desc", "status.asc"])(
    "keeps the cursor consistent under sort=%s",
    async (sort) => {
      const pages = await walk({ sort }, 3);
      expect(pages).toHaveLength(3);
      const rows = pages.flatMap((page) => page.data);
      expect(rows).toHaveLength(120);
      expect(new Set(rows.map((row) => row.uuid)).size).toBe(120);
      expect(isDescending(rows)).toBe(true);
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

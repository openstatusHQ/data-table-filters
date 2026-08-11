import { describe, expect, it } from "vitest";
import { GET } from "./route";

type Result = { title: string; slug: string; href: string; content: string };

async function search(query: string): Promise<Result[]> {
  const response = await GET(
    new Request(
      `http://localhost/docs/api/search?q=${encodeURIComponent(query)}`,
    ),
  );
  return response.json();
}

describe("docs search route", () => {
  it("returns nothing without a query", async () => {
    const response = await GET(new Request("http://localhost/docs/api/search"));

    expect(await response.json()).toEqual([]);
  });

  it("answers a multi-word question the substring search could not", async () => {
    // No page contains this as a literal string; ranking is what finds it.
    const results = await search("keep filter state in the url");

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].slug).toBe("state-management");
  });

  it("lists each page once", async () => {
    const slugs = (await search("filter")).map((result) => result.slug);

    expect(slugs).toHaveLength(new Set(slugs).size);
  });

  it("links to the matching section and carries the query for highlighting", async () => {
    const [first] = await search("cursor pagination");

    expect(first.href).toMatch(
      /^\/docs\/[\w-]+\?q=cursor(%20|\+)pagination#[\w-]+$/,
    );
  });

  it("returns a plain-text snippet, not markdown", async () => {
    const [first] = await search("faceted counts");

    expect(first.content).not.toContain("```");
    expect(first.content).not.toMatch(/\[[^\]]+\]\(/);
    expect(first.content.length).toBeGreaterThan(0);
  });

  it("returns nothing for a query with no scorable terms", async () => {
    expect(await search("what is it")).toEqual([]);
  });
});

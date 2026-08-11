import { getAllSections } from "@/lib/mdx";
import { BASE_URL } from "@/lib/metadata/shared-metadata";
import { describe, expect, it } from "vitest";
import { GET } from "./route";

function request(slug: string) {
  return GET(new Request(`${BASE_URL}/docs/${slug}.md`), {
    params: Promise.resolve({ slug }),
  });
}

describe("raw markdown route", () => {
  it("serves markdown for a real page", async () => {
    const response = await request("quick-start");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "text/markdown; charset=utf-8",
    );
    expect(await response.text()).not.toBe("");
  });

  it("points every page at its html twin as the canonical url", async () => {
    const sections = await getAllSections("docs");

    expect(sections.length).toBeGreaterThan(0);
    for (const section of sections) {
      const response = await request(section.slug);

      expect(response.headers.get("link")).toBe(
        `<${BASE_URL}/docs/${section.slug}>; rel="canonical"`,
      );
    }
  });

  it("404s an unknown slug", async () => {
    const response = await request("not-a-real-page");

    expect(response.status).toBe(404);
  });
});

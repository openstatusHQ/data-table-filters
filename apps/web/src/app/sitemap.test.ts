import { getAllSections } from "@/lib/mdx";
import { BASE_URL } from "@/lib/metadata/shared-metadata";
import { describe, expect, it } from "vitest";
import sitemap from "./sitemap";

describe("sitemap", () => {
  it("lists the agent entry points", async () => {
    const urls = (await sitemap()).map((entry) => entry.url);

    expect(urls).toContain(`${BASE_URL}/llms.txt`);
    expect(urls).toContain(`${BASE_URL}/llms-full.txt`);
    expect(urls).toContain(`${BASE_URL}/r/index.md`);
  });

  it("lists both representations of every docs page", async () => {
    const sections = await getAllSections("docs");
    const urls = (await sitemap()).map((entry) => entry.url);

    expect(sections.length).toBeGreaterThan(0);
    for (const section of sections) {
      expect(urls).toContain(`${BASE_URL}/docs/${section.slug}`);
      expect(urls).toContain(`${BASE_URL}/docs/${section.slug}.md`);
    }
  });

  it("ranks the html page above its markdown twin", async () => {
    const entries = await sitemap();
    const html = entries.find((entry) =>
      entry.url.endsWith("/docs/quick-start"),
    );
    const markdown = entries.find((entry) =>
      entry.url.endsWith("/docs/quick-start.md"),
    );

    expect(html?.priority).toBeGreaterThan(markdown?.priority ?? 0);
  });

  it("has no duplicate urls", async () => {
    const urls = (await sitemap()).map((entry) => entry.url);

    expect(urls).toHaveLength(new Set(urls).size);
  });
});

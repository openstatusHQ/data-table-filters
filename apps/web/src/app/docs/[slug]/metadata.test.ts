import { getAllSections } from "@/lib/mdx";
import { describe, expect, it } from "vitest";
import { generateMetadata } from "./page";

describe("docs page metadata", () => {
  it("points every page at its markdown twin", async () => {
    const sections = await getAllSections("docs");

    expect(sections.length).toBeGreaterThan(0);
    for (const section of sections) {
      const metadata = await generateMetadata({
        params: Promise.resolve({ slug: section.slug }),
      });

      // The .md route answers with the html page as its canonical url; this is
      // the other half of that pair, so an agent landing on the html can find
      // the cheap representation without scraping the DOM.
      expect(metadata?.alternates?.canonical).toBe(`/docs/${section.slug}`);
      expect(metadata?.alternates?.types?.["text/markdown"]).toEqual([
        expect.objectContaining({ url: `/docs/${section.slug}.md` }),
      ]);
    }
  });

  it("advertises llms.txt", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: "quick-start" }),
    });

    expect(metadata?.alternates?.types?.["text/plain"]).toEqual([
      expect.objectContaining({ url: "/llms.txt" }),
    ]);
  });

  it("returns nothing for an unknown page", async () => {
    expect(
      await generateMetadata({
        params: Promise.resolve({ slug: "not-a-real-page" }),
      }),
    ).toBeUndefined();
  });
});

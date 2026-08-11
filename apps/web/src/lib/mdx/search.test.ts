import { describe, expect, it } from "vitest";
import { getAllSections, getSection, type SectionMeta } from "./get-content";
import { searchDocs, splitIntoSections, tokenize, toPlainText } from "./search";

function meta(overrides: Partial<SectionMeta> = {}): SectionMeta {
  return {
    title: "Drizzle ORM",
    description: "Server-side filtering",
    slug: "drizzle-orm",
    order: 7,
    author: "openstatus",
    publishedAt: "2026-01-01",
    ...overrides,
  };
}

describe("tokenize", () => {
  it("drops stopwords and single characters", () => {
    expect(tokenize("How do I use the nuqs adapter")).toEqual([
      "nuqs",
      "adapter",
    ]);
  });

  it("keeps dotted and scoped identifiers whole", () => {
    expect(tokenize("col.string and @dtf/registry")).toEqual([
      "col.string",
      "@dtf",
      "registry",
    ]);
  });

  it("returns nothing for a query made only of stopwords", () => {
    expect(tokenize("what is it for")).toEqual([]);
  });
});

describe("splitIntoSections", () => {
  it("splits on h2 and h3, keeping the opening text", () => {
    const sections = splitIntoSections(
      meta(),
      "# Drizzle ORM\n\nIntro line.\n\n## Setup\n\nInstall it.\n\n### Cursor\n\nUse a tiebreaker.",
    );

    expect(sections.map((section) => section.heading)).toEqual([
      null,
      "Setup",
      "Cursor",
    ]);
    expect(sections[1].body).toBe("Install it.");
    expect(sections[2].anchor).toBe("cursor");
  });

  it("ignores headings inside code fences", () => {
    const sections = splitIntoSections(
      meta(),
      "## Setup\n\n```bash\n## not a heading\npnpm add drizzle-orm\n```\n\nDone.",
    );

    expect(sections).toHaveLength(1);
    expect(sections[0].heading).toBe("Setup");
    expect(sections[0].body).toContain("## not a heading");
  });

  it("skips a heading that has no body of its own", () => {
    const sections = splitIntoSections(meta(), "## Empty\n\n## Real\n\nText.");

    expect(sections.map((section) => section.heading)).toEqual([
      "Empty",
      "Real",
    ]);
  });
});

describe("searchDocs", () => {
  const sections = [
    ...splitIntoSections(
      meta(),
      "## Cursor Pagination\n\nRows are paged with a cursor and a tiebreaker column.\n\n## Facets\n\nCounts are computed in SQL.",
    ),
    ...splitIntoSections(
      meta({ title: "State Management", slug: "state-management" }),
      "## Adapters\n\nThe nuqs adapter keeps filter state in the URL. Pagination is unrelated here.",
    ),
  ];

  it("ranks a matching heading above a passing mention", () => {
    const [first] = searchDocs(sections, "pagination");

    expect(first.heading).toBe("Cursor Pagination");
    expect(first.slug).toBe("drizzle-orm");
  });

  it("prefers the section that covers more of the query", () => {
    const [first] = searchDocs(sections, "nuqs adapter url state");

    expect(first.slug).toBe("state-management");
  });

  it("returns nothing when no term matches", () => {
    expect(searchDocs(sections, "graphql subscriptions")).toEqual([]);
  });

  it("returns nothing for a query with no scorable terms", () => {
    expect(searchDocs(sections, "what is it")).toEqual([]);
  });

  it("honours the limit", () => {
    expect(searchDocs(sections, "in the sql url", { limit: 1 })).toHaveLength(
      1,
    );
  });

  it("returns the anchor of the matching section", () => {
    const [first] = searchDocs(sections, "facets");

    expect(first).toMatchObject({ slug: "drizzle-orm", anchor: "facets" });
  });

  it("keeps every matching section by default", () => {
    const results = searchDocs(sections, "cursor counts sql", { limit: 10 });

    expect(
      results.filter((result) => result.slug === "drizzle-orm").length,
    ).toBeGreaterThan(1);
  });

  it("collapses to the best section per page when asked", () => {
    const results = searchDocs(sections, "cursor counts sql", {
      limit: 10,
      onePerPage: true,
    });
    const slugs = results.map((result) => result.slug);

    expect(slugs).toHaveLength(new Set(slugs).size);
    // The collapsed row keeps the page's strongest section, not its first.
    expect(results[0].heading).toBe("Cursor Pagination");
  });

  it("ranks a page about the phrase above a page quoting it", () => {
    // The agents docs print example queries; that must not outrank the page
    // those queries are asking about.
    const quoting = splitIntoSections(
      meta({ title: "For AI Agents", slug: "agents" }),
      '## Tools\n\nAsk it "how do faceted counts work" and it finds the section.',
    );
    const answering = splitIntoSections(
      meta({ title: "Data Layer", slug: "data-layer" }),
      "## Faceted Search\n\nGrouped counts per filter option, computed in SQL.",
    );

    const [first] = searchDocs(
      [...quoting, ...answering],
      "how do faceted counts work",
    );

    expect(first.slug).toBe("data-layer");
  });

  it("snippets prose, not markdown syntax", () => {
    const [first] = searchDocs(
      splitIntoSections(
        meta(),
        "## Handler\n\nCall [`createDrizzleHandler`](/docs/drizzle-orm) with **your** table.",
      ),
      "createDrizzleHandler",
    );

    expect(first.snippet).toBe("Call createDrizzleHandler with your table.");
  });

  it("snippets around the match rather than from the top", () => {
    const [first] = searchDocs(
      splitIntoSections(
        meta(),
        `## Long\n\n${"padding word ".repeat(40)}tiebreaker column here.`,
      ),
      "tiebreaker",
    );

    expect(first.snippet).toContain("tiebreaker");
    expect(first.snippet.startsWith("…")).toBe(true);
  });
});

describe("toPlainText", () => {
  it("unwraps links, emphasis, and inline code", () => {
    expect(
      toPlainText("See [the **docs**](/docs/x) for `col.string()` usage."),
    ).toBe("See the docs for col.string() usage.");
  });

  it("keeps code but drops the fence markers", () => {
    expect(toPlainText("```ts\nconst a = generateColumns(schema);\n```")).toBe(
      "const a = generateColumns(schema);",
    );
  });

  it("leaves underscored identifiers alone", () => {
    expect(toPlainText("Use `filterSchema._type` and `snake_case` keys.")).toBe(
      "Use filterSchema._type and snake_case keys.",
    );
  });

  it("drops table separator rows and blockquote markers", () => {
    expect(
      toPlainText(
        "| Option | Default |\n| --- | --- |\n| size | 40 |\n\n> Note.",
      ),
    ).toBe("| Option | Default | | size | 40 | Note.");
  });

  it("strips heading markers", () => {
    expect(toPlainText("### Cursor Pagination\n\nRows are paged.")).toBe(
      "Cursor Pagination Rows are paged.",
    );
  });
});

describe("against the real docs", () => {
  it("finds the drizzle page for a server-side filtering question", async () => {
    const metas = await getAllSections("docs");
    const sections = (
      await Promise.all(
        metas.map(async (section) => {
          const doc = await getSection("docs", section.slug);
          return doc ? splitIntoSections(section, doc.source) : [];
        }),
      )
    ).flat();

    const results = searchDocs(
      sections,
      "filter rows server-side with drizzle",
    );

    expect(results.length).toBeGreaterThan(0);
    expect(results.map((result) => result.slug)).toContain("drizzle-orm");
  });

  it("every section carries the page it came from", async () => {
    const metas = await getAllSections("docs");
    const doc = await getSection("docs", "quick-start");
    const sections = splitIntoSections(metas[1], doc!.source);

    expect(sections.length).toBeGreaterThan(1);
    for (const section of sections) {
      expect(section.slug).toBe(metas[1].slug);
      expect(section.body).not.toBe("");
    }
  });
});

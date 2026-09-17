import type { SectionMeta } from "@/lib/mdx";
import { getAllSections, getSection } from "@/lib/mdx";
import { describe, expect, it } from "vitest";
import {
  BLOCK_GUIDANCE,
  blockRef,
  CREATE_PROJECT,
  CREATE_PROJECT_COMMAND,
  EXAMPLE_BLOCK,
  PREREQUISITE,
  RECIPES,
  registryItems,
} from "./blocks";
import {
  blockUrl,
  buildDocMarkdown,
  buildLlmsFullTxt,
  buildLlmsTxt,
  buildRegistryIndexMd,
  installCommand,
  stripLeadingH1,
} from "./build";

const sections: SectionMeta[] = [
  {
    title: "Quick Start",
    description: "Install the blocks and render a table",
    slug: "quick-start",
    order: 1,
    author: "openstatus",
    publishedAt: "2026-03-12",
  },
  {
    title: "Drizzle ORM",
    description: "Server-side filtering with Drizzle",
    slug: "drizzle-orm",
    order: 7,
    author: "openstatus",
    publishedAt: "2026-03-12",
  },
];

describe("block guidance", () => {
  it("documents every registry block", () => {
    const undocumented = registryItems
      .map((item) => item.name)
      .filter((name) => !BLOCK_GUIDANCE[name]);

    expect(undocumented).toEqual([]);
  });

  it("has no guidance for blocks that no longer exist", () => {
    const names = new Set(registryItems.map((item) => item.name));
    const stale = Object.keys(BLOCK_GUIDANCE).filter(
      (name) => !names.has(name),
    );

    expect(stale).toEqual([]);
  });

  it("only references real blocks in recipes", () => {
    const names = new Set(registryItems.map((item) => item.name));
    const unknown = RECIPES.flatMap((recipe) => recipe.blocks).filter(
      (block) => !names.has(block),
    );

    expect(unknown).toEqual([]);
  });

  it("starts every recipe with the core block", () => {
    for (const recipe of RECIPES) {
      expect(recipe.blocks[0]).toBe("data-table");
    }
  });

  it("gives every recipe a unique id", () => {
    const ids = RECIPES.map((recipe) => recipe.id);

    expect(ids).toHaveLength(new Set(ids).size);
  });

  it("only sends readers to docs pages that exist", async () => {
    const slugs = new Set(
      (await getAllSections("docs")).map((section) => section.slug),
    );
    const unknown = RECIPES.flatMap((recipe) => recipe.docs).filter(
      (slug) => !slugs.has(slug),
    );

    expect(unknown).toEqual([]);
  });
});

describe("installCommand", () => {
  it("builds a single shadcn command for a block list", () => {
    expect(installCommand(["data-table", "data-table-nuqs"])).toBe(
      `npx shadcn@latest add ${blockRef("data-table")} ${blockRef("data-table-nuqs")}`,
    );
  });
});

describe("stripLeadingH1", () => {
  it("removes a leading H1 so pages have a single title", () => {
    expect(stripLeadingH1("# Introduction\n\nBody text")).toBe("Body text");
  });

  it("leaves content without a leading H1 untouched", () => {
    expect(stripLeadingH1("Body text\n\n# Later heading")).toBe(
      "Body text\n\n# Later heading",
    );
  });

  it("does not remove deeper headings", () => {
    expect(stripLeadingH1("## Section\n\nBody")).toBe("## Section\n\nBody");
  });
});

describe("buildLlmsTxt", () => {
  const output = buildLlmsTxt(sections);

  it("links every docs page as markdown", () => {
    for (const section of sections) {
      expect(output).toContain(`/docs/${section.slug}.md`);
      expect(output).toContain(section.title);
    }
  });

  it("lists every registry block with its install URL", () => {
    for (const item of registryItems) {
      expect(output).toContain(blockUrl(item.name));
    }
  });

  it("includes a copy-pasteable command for every recipe", () => {
    for (const recipe of RECIPES) {
      expect(output).toContain(installCommand(recipe.blocks));
    }
  });

  it("points at the full-text and registry index files", () => {
    expect(output).toContain("/llms-full.txt");
    expect(output).toContain("/r/index.md");
  });

  it("states the component library line before the first recipe", () => {
    expect(output.indexOf(PREREQUISITE)).toBeGreaterThan(-1);
    expect(output.indexOf(PREREQUISITE)).toBeLessThan(
      output.indexOf("npx shadcn@latest add"),
    );
  });

  it("states the create-project command right after the library line", () => {
    expect(output).toContain(CREATE_PROJECT);
    expect(output.indexOf(CREATE_PROJECT)).toBeGreaterThan(
      output.indexOf(PREREQUISITE),
    );
    expect(output.indexOf(CREATE_PROJECT)).toBeLessThan(
      output.indexOf("npx shadcn@latest add"),
    );
  });
});

describe("the create-project line", () => {
  it("carries the command and both library variants", () => {
    expect(CREATE_PROJECT).toContain(CREATE_PROJECT_COMMAND);
    expect(CREATE_PROJECT).toContain("Base UI");
    expect(CREATE_PROJECT).toContain("-b radix");
  });

  it("points the command at this site's example block", () => {
    expect(CREATE_PROJECT_COMMAND).toContain(blockRef(EXAMPLE_BLOCK));
    expect(CREATE_PROJECT_COMMAND).not.toContain("/r/");
    expect(CREATE_PROJECT).toContain("localhost:3000/example");
  });
});

describe("the component library line", () => {
  it("names both libraries and the command for each", () => {
    expect(PREREQUISITE).toContain("npx shadcn@latest init -d");
    expect(PREREQUISITE).toContain("npx shadcn@latest init -b radix -p nova");
    expect(PREREQUISITE).toContain("Base UI");
    // The blocks install on either library; a surface claiming otherwise is
    // out of date with `registry-install.yml`, which proves both.
    expect(PREREQUISITE).not.toContain("not supported");
  });

  it("is repeated in the full docs and the registry index", () => {
    expect(buildLlmsFullTxt([])).toContain(PREREQUISITE);
    expect(buildRegistryIndexMd()).toContain(PREREQUISITE);
  });

  it("comes before the first install command in every generated file", () => {
    for (const output of [
      buildLlmsTxt(sections),
      buildLlmsFullTxt([]),
      buildRegistryIndexMd(),
    ]) {
      expect(output.indexOf(PREREQUISITE)).toBeGreaterThan(-1);
      expect(output.indexOf(PREREQUISITE)).toBeLessThan(
        output.indexOf("npx shadcn@latest add"),
      );
    }
  });
});

describe("buildLlmsFullTxt", () => {
  it("inlines each page under its frontmatter title, without a duplicate H1", () => {
    const output = buildLlmsFullTxt([
      { meta: sections[0], source: "# Quick Start\n\nRun the CLI." },
    ]);

    expect(output).toContain("# Quick Start");
    expect(output.match(/# Quick Start/g)).toHaveLength(1);
    expect(output).toContain("Run the CLI.");
    expect(output).toContain("/docs/quick-start");
  });
});

describe("buildDocMarkdown", () => {
  it("prefixes the page with title, description, and provenance", () => {
    const output = buildDocMarkdown(
      sections[0],
      "# Quick Start\n\nRun the CLI.",
    );

    expect(output.startsWith("# Quick Start")).toBe(true);
    expect(output).toContain(sections[0].description);
    expect(output).toContain("/llms.txt");
    expect(output.match(/# Quick Start/g)).toHaveLength(1);
  });
});

describe("buildRegistryIndexMd", () => {
  const output = buildRegistryIndexMd();

  it("documents every block in the table", () => {
    for (const item of registryItems) {
      expect(output).toContain(`\`${item.name}\``);
      expect(output).toContain(blockUrl(item.name));
    }
  });

  it("spells out which blocks each block pulls in", () => {
    expect(output).toContain("## Block dependencies");
    expect(output).toContain("no other blocks");
  });
});

describe("generated output against the real docs", () => {
  it("covers every published docs page", async () => {
    const realSections = await getAllSections("docs");
    const output = buildLlmsTxt(realSections);

    expect(realSections.length).toBeGreaterThan(0);
    for (const section of realSections) {
      expect(output).toContain(`/docs/${section.slug}.md`);
    }
  });

  it("renders each real page without an empty body", async () => {
    const realSections = await getAllSections("docs");

    for (const meta of realSections) {
      const section = await getSection("docs", meta.slug);
      expect(section).not.toBeNull();
      const markdown = buildDocMarkdown(meta, section!.source);
      expect(markdown.length).toBeGreaterThan(meta.description.length + 100);
    }
  });
});

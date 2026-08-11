import type { SectionMeta } from "@/lib/mdx";
import { describe, expect, it, vi } from "vitest";
import { RECIPES, registryItems } from "./blocks";
import type { DocSource } from "./build";
import {
  createDocsMcpHandler,
  sectionLoader,
  type DocsSource,
} from "./docs-mcp";

function meta(slug: string, title: string): SectionMeta {
  return {
    title,
    description: `${title} description`,
    slug,
    order: 1,
    author: "openstatus",
    publishedAt: "2026-01-01",
  };
}

const DOCS: DocSource[] = [
  {
    meta: meta("drizzle-orm", "Drizzle ORM"),
    source:
      "# Drizzle ORM\n\nIntro.\n\n## Cursor Pagination\n\nRows are paged with a cursor and a tiebreaker column.\n\n## Facets\n\nCounts are computed in SQL.",
  },
  {
    meta: meta("state-management", "State Management"),
    source:
      "# State Management\n\n## Adapters\n\nThe nuqs adapter keeps filter state in the URL.",
  },
  {
    meta: meta("table-schema", "Table Schema"),
    source: "# Table Schema\n\nOne definition.",
  },
  {
    meta: meta("data-fetching", "Data Fetching"),
    source: "# Data Fetching\n\nReact Query.",
  },
  {
    meta: meta("quick-start", "Quick Start"),
    source: "# Quick Start\n\nInstall it.",
  },
  {
    meta: meta("ui-components", "UI Components"),
    source: "# UI Components\n\nCells.",
  },
  { meta: meta("builder", "Builder"), source: "# Builder\n\nPaste JSON." },
  {
    meta: meta("ai-filters", "AI Filters"),
    source: "# AI Filters\n\nNatural language.",
  },
  {
    meta: meta("mcp", "MCP Server"),
    source: "# MCP Server\n\nQuery the table.",
  },
];

const handler = createDocsMcpHandler(async () => DOCS);

async function rpc(method: string, params?: unknown) {
  const response = await handler(
    new Request("http://localhost/api/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    }),
  );

  return response.json();
}

async function callTool(name: string, args: Record<string, unknown> = {}) {
  const body = await rpc("tools/call", { name, arguments: args });
  return body.result;
}

/** Tool results are text; the structured tools answer with JSON in it. */
function parse(result: { content: { text: string }[] }) {
  return JSON.parse(result.content[0].text);
}

describe("docs mcp server", () => {
  it("advertises the four tools", async () => {
    const { result } = await rpc("tools/list");

    expect(
      result.tools.map((tool: { name: string }) => tool.name).sort(),
    ).toEqual(["get_doc", "get_install_plan", "list_blocks", "search_docs"]);
  });

  it("declares every tool read-only", async () => {
    const { result } = await rpc("tools/list");

    for (const tool of result.tools) {
      expect(tool.annotations?.readOnlyHint, tool.name).toBe(true);
    }
  });

  it("tells the client where to start", async () => {
    const { result } = await rpc("initialize", {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "test", version: "1.0.0" },
    });

    expect(result.serverInfo.name).toBe("data-table-filters-docs");
    expect(result.instructions).toContain("get_install_plan");
  });
});

describe("transport", () => {
  it("refuses GET rather than opening a stream it closes immediately", async () => {
    const response = await handler(
      new Request("http://localhost/api/mcp", {
        method: "GET",
        headers: { Accept: "text/event-stream" },
      }),
    );

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST, DELETE");
    expect(await response.json()).toMatchObject({
      error: { code: -32000 },
    });
  });
});

describe("sectionLoader", () => {
  it("reads the docs once across requests", async () => {
    const load = vi.fn(async () => DOCS);
    const cached = sectionLoader(load);

    await Promise.all([cached(), cached()]);
    await cached();

    expect(load).toHaveBeenCalledTimes(1);
  });

  it("retries after a failed read instead of caching the failure", async () => {
    const load = vi
      .fn<DocsSource>()
      .mockRejectedValueOnce(new Error("EMFILE"))
      .mockResolvedValue(DOCS);
    const cached = sectionLoader(load);

    await expect(cached()).rejects.toThrow("EMFILE");
    await expect(cached()).resolves.toMatchObject({ docs: DOCS });
    expect(load).toHaveBeenCalledTimes(2);
  });
});

describe("search_docs", () => {
  it("returns the section that answers the query", async () => {
    const { results } = parse(
      await callTool("search_docs", { query: "cursor pagination" }),
    );

    expect(results[0]).toMatchObject({
      slug: "drizzle-orm",
      heading: "Cursor Pagination",
    });
    expect(results[0].snippet).toContain("tiebreaker");
  });

  it("hides the ranking score from the client", async () => {
    const { results } = parse(
      await callTool("search_docs", { query: "facets" }),
    );

    expect(results[0]).not.toHaveProperty("score");
  });

  it("honours the limit", async () => {
    const { results } = parse(
      await callTool("search_docs", { query: "the url in sql", limit: 1 }),
    );

    expect(results).toHaveLength(1);
  });

  it("points somewhere useful when nothing matches", async () => {
    const { results, hint } = parse(
      await callTool("search_docs", { query: "graphql subscriptions" }),
    );

    expect(results).toEqual([]);
    expect(hint).toContain("list_blocks");
    expect(hint).toContain("drizzle-orm");
  });
});

describe("get_doc", () => {
  it("returns a whole page with its provenance header", async () => {
    const result = await callTool("get_doc", { slug: "drizzle-orm" });
    const markdown = result.content[0].text;

    expect(markdown).toContain("# Drizzle ORM");
    expect(markdown).toContain(
      "Source: https://data-table.openstatus.dev/docs/drizzle-orm",
    );
    expect(markdown).toContain("Counts are computed in SQL.");
  });

  it("returns a single section when asked for a heading", async () => {
    const result = await callTool("get_doc", {
      slug: "drizzle-orm",
      heading: "Facets",
    });
    const markdown = result.content[0].text;

    expect(markdown).toContain("Counts are computed in SQL.");
    expect(markdown).not.toContain("tiebreaker");
  });

  it("matches a heading regardless of case", async () => {
    const result = await callTool("get_doc", {
      slug: "drizzle-orm",
      heading: "cursor pagination",
    });

    expect(result.content[0].text).toContain("tiebreaker");
  });

  it("lists the real slugs for an unknown page", async () => {
    const result = await callTool("get_doc", { slug: "postgres" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("drizzle-orm");
  });

  it("lists the real headings for an unknown heading", async () => {
    const result = await callTool("get_doc", {
      slug: "drizzle-orm",
      heading: "Sharding",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Facets");
  });
});

describe("list_blocks", () => {
  it("returns every block with its url and guidance", async () => {
    const { blocks } = parse(await callTool("list_blocks"));

    expect(blocks).toHaveLength(registryItems.length);
    for (const block of blocks) {
      expect(block.url).toBe(
        `https://data-table.openstatus.dev/r/${block.name}.json`,
      );
      expect(block.useWhen, block.name).toBeTruthy();
    }
  });

  it("names the blocks each block pulls in", async () => {
    const { blocks } = parse(await callTool("list_blocks"));
    const sheet = blocks.find(
      (block: { name: string }) => block.name === "data-table-sheet",
    );

    expect(sheet.pullsIn).toContain("data-table-cell");
  });
});

describe("get_install_plan", () => {
  it("returns one command for the goal", async () => {
    const plan = parse(
      await callTool("get_install_plan", { goal: "large-table" }),
    );

    expect(plan.command).toContain("npx shadcn@latest add");
    expect(plan.blocks).toEqual(
      RECIPES.find((recipe) => recipe.id === "large-table")?.blocks,
    );
    for (const block of plan.blocks) {
      expect(plan.command).toContain(`/r/${block}.json`);
    }
  });

  it("names the pages to read next", async () => {
    const plan = parse(
      await callTool("get_install_plan", { goal: "large-table" }),
    );

    expect(plan.readNext).toContainEqual({
      slug: "drizzle-orm",
      title: "Drizzle ORM",
    });
  });

  it("rejects a goal that is not a recipe", async () => {
    const body = await rpc("tools/call", {
      name: "get_install_plan",
      arguments: { goal: "not-a-goal" },
    });

    // Rejected by the schema, so the agent sees the allowed values.
    expect(JSON.stringify(body)).toContain("large-table");
  });

  it.each(RECIPES.map((recipe) => recipe.id))("plans %s", async (goal) => {
    const plan = parse(await callTool("get_install_plan", { goal }));

    expect(plan.blocks.length).toBeGreaterThan(0);
    expect(plan.wiring).toBeTruthy();
    expect(plan.readNext.length).toBeGreaterThan(0);
  });
});

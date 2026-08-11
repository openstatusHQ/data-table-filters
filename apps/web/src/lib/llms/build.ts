import type { SectionMeta } from "@/lib/mdx";
import { BASE_URL } from "@/lib/metadata/shared-metadata";
import { BLOCK_GUIDANCE, RECIPES, registryItems } from "./blocks";

export type DocSource = { meta: SectionMeta; source: string };

const SUMMARY =
  "Open-source React data table with faceted filters, sorting, infinite scroll, and virtualization. Distributed as shadcn registry blocks you install into your own repo — not as an npm dependency, so there is no library to wrap and nothing to eject from.";

const FACTS = [
  "Stack: React 19+, TanStack Table v8, Tailwind CSS v4, shadcn/ui. Next.js App Router is first-class; the blocks work in any React app.",
  "Install with `npx shadcn@latest add <url>`. The shadcn CLI resolves block dependencies, rewrites `@/` import paths to match components.json, and injects the required CSS variables.",
  "Built for large tables: filtering, faceted counts, sorting, and cursor pagination all execute in SQL, and rows are virtualized, so table size is bounded by the database rather than the browser.",
  "One `createTableSchema` definition drives the columns, the filter controls, the row detail sheet, the server-side query handler, the natural-language filter parser, and the MCP tool schema.",
];

export function blockUrl(name: string): string {
  return `${BASE_URL}/r/${name}.json`;
}

export function installCommand(names: string[]): string {
  return `npx shadcn@latest add ${names.map(blockUrl).join(" ")}`;
}

function docUrl(slug: string, extension = ""): string {
  return `${BASE_URL}/docs/${slug}${extension}`;
}

/**
 * Docs pages open with their own `# Title`, and every renderer here emits a
 * heading from the frontmatter — drop the duplicate so each page has one H1.
 */
export function stripLeadingH1(source: string): string {
  return source.trimStart().replace(/^#\s+.*(\r?\n)+/, "");
}

/**
 * `/llms.txt` — the index an agent reads first: what this is, which blocks
 * exist, which to install for a given goal, and where the full text lives.
 */
export function buildLlmsTxt(sections: SectionMeta[]): string {
  const lines: string[] = [
    "# data-table-filters",
    "",
    `> ${SUMMARY}`,
    "",
    ...FACTS.map((fact) => `- ${fact}`),
    "",
    "## Recipes",
    "",
    "Install the blocks for the goal, in the order listed.",
    "",
  ];

  for (const recipe of RECIPES) {
    lines.push(
      `### ${recipe.title}`,
      "",
      `When: ${recipe.when}`,
      "",
      "```bash",
      installCommand(recipe.blocks),
      "```",
      "",
      recipe.notes,
      "",
    );
  }

  lines.push("## Registry blocks", "");
  for (const item of registryItems) {
    const guidance = BLOCK_GUIDANCE[item.name];
    lines.push(
      `- [${item.name}](${blockUrl(item.name)}): ${item.description ?? ""}${
        guidance ? ` **Use when:** ${guidance}` : ""
      }`,
    );
  }

  lines.push("", "## Docs", "");
  for (const section of sections) {
    lines.push(
      `- [${section.title}](${docUrl(section.slug, ".md")}): ${section.description}`,
    );
  }

  lines.push(
    "",
    "## Optional",
    "",
    `- [llms-full.txt](${BASE_URL}/llms-full.txt): every documentation page inlined in one file`,
    `- [Registry index](${BASE_URL}/r/index.md): block catalog with install commands and dependencies`,
    `- [Registry manifest](${BASE_URL}/r/registry.json): machine-readable shadcn registry`,
    `- [Claude Code plugin](https://github.com/openstatushq/data-table-filters): \`/plugin marketplace add openstatushq/data-table-filters\` then \`/plugin install data-table-filters@openstatus\``,
    `- [Agent skill](https://github.com/openstatushq/data-table-filters): \`npx skills add https://github.com/openstatushq/data-table-filters --skill data-table-filters\``,
    "",
  );

  return lines.join("\n");
}

/**
 * `/llms-full.txt` — every doc page in one request, so an agent can load the
 * whole surface without a fetch per page.
 */
export function buildLlmsFullTxt(docs: DocSource[]): string {
  const parts: string[] = [
    "# data-table-filters — full documentation",
    "",
    `> ${SUMMARY}`,
    "",
    ...FACTS.map((fact) => `- ${fact}`),
    "",
    `Source: ${BASE_URL}/docs — index at ${BASE_URL}/llms.txt`,
    "",
  ];

  for (const { meta, source } of docs) {
    parts.push(
      "---",
      "",
      `# ${meta.title}`,
      "",
      `Source: ${docUrl(meta.slug)}`,
      "",
      stripLeadingH1(source).trim(),
      "",
    );
  }

  return parts.join("\n");
}

/**
 * `/docs/<slug>.md` — one page as raw markdown, with enough of a header that a
 * page fetched on its own still says where it came from and what else exists.
 */
export function buildDocMarkdown(meta: SectionMeta, source: string): string {
  return [
    `# ${meta.title}`,
    "",
    `> ${meta.description}`,
    "",
    `Source: ${docUrl(meta.slug)} · Docs index: ${BASE_URL}/llms.txt · Full docs: ${BASE_URL}/llms-full.txt`,
    "",
    stripLeadingH1(source).trim(),
    "",
  ].join("\n");
}

/**
 * `/r/index.md` — the registry manifest is a machine format for the shadcn CLI;
 * this is the same catalog written for whoever has to choose between the blocks.
 */
export function buildRegistryIndexMd(): string {
  const lines: string[] = [
    "# data-table-filters registry",
    "",
    `> ${SUMMARY}`,
    "",
    `Install any block with \`npx shadcn@latest add ${blockUrl("<block>")}\`. Blocks may be combined in a single command; the CLI installs each block's registry dependencies automatically, so listing a dependency explicitly is redundant but harmless.`,
    "",
    "## Blocks",
    "",
    "| Block | Install URL | What it adds | Use when |",
    "| --- | --- | --- | --- |",
  ];

  for (const item of registryItems) {
    lines.push(
      `| \`${item.name}\` | \`${blockUrl(item.name)}\` | ${item.description ?? ""} | ${BLOCK_GUIDANCE[item.name] ?? ""} |`,
    );
  }

  lines.push("", "## Recipes", "");
  for (const recipe of RECIPES) {
    lines.push(
      `### ${recipe.title}`,
      "",
      `When: ${recipe.when}`,
      "",
      "```bash",
      installCommand(recipe.blocks),
      "```",
      "",
      recipe.notes,
      "",
    );
  }

  lines.push("## Block dependencies", "");
  for (const item of registryItems) {
    const deps = item.registryDependencies ?? [];
    const registryDeps = deps
      .filter((dep) => dep.startsWith(BASE_URL))
      .map((dep) => dep.replace(`${BASE_URL}/r/`, "").replace(/\.json$/, ""));
    lines.push(
      `- \`${item.name}\` pulls in: ${
        registryDeps.length
          ? registryDeps.map((dep) => `\`${dep}\``).join(", ")
          : "no other blocks"
      }`,
    );
  }

  lines.push(
    "",
    "## More",
    "",
    `- Docs index for agents: ${BASE_URL}/llms.txt`,
    `- Full documentation in one file: ${BASE_URL}/llms-full.txt`,
    `- Any docs page as raw markdown: append \`.md\` (e.g. ${docUrl("quick-start", ".md")})`,
    "",
  );

  return lines.join("\n");
}

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  CREATE_PROJECT_COMMAND,
  PREREQUISITE,
  QUICK_START_BLOCKS,
  RADIX_INIT_COMMAND,
  RECIPES,
  registryItems,
} from "./blocks";

// The install commands, block lists, and counts an agent reads are written by
// hand in half a dozen files — README, AGENTS.md, the Cursor rule, the skill,
// and the docs pages. `registry.json` is the only source of truth for any of
// it, so these tests pin the prose to the manifest: a renamed block or a new
// file fails here instead of sending an agent after a 404.

const repoRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../..",
);

function read(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), "utf8");
}

/** Prose an agent reads to decide what to install and what it gets. */
const AGENT_FACING_FILES = [
  "README.md",
  "AGENTS.md",
  ".cursor/rules/data-table-filters.mdc",
  "skills/data-table-filters/SKILL.md",
  "skills/data-table-filters/references/component-catalog.md",
  "apps/web/src/content/docs/01-quick-start.mdx",
  "apps/web/src/content/docs/04-ui-components.mdx",
  "apps/web/src/content/docs/13-agents.mdx",
] as const;

/** The subset that hands out install URLs. */
const INSTALL_DOC_FILES = AGENT_FACING_FILES.filter(
  (file) => file !== "apps/web/src/content/docs/04-ui-components.mdx",
);

/** Served from `/r/` alongside the blocks, but not a block. */
const NOT_A_BLOCK = new Set(["registry", "index"]);

const blockNames = new Set(registryItems.map((item) => item.name));

const filesByBlock = new Map(
  registryItems.map((item) => [item.name, item.files?.length ?? 0]),
);

/** `DataTableCellBar` … as exported by the cell block's barrel file. */
const cellRenderers = Array.from(
  read(
    "packages/registry/src/components/data-table/data-table-cell/index.tsx",
  ).matchAll(/export \{ (DataTableCell\w+) \}/g),
).map((match) => match[1]);

/** `bar`, `status-code` … the renderer names prose uses, from the file names. */
const cellRendererSlugs = new Set(
  Array.from(
    read(
      "packages/registry/src/components/data-table/data-table-cell/index.tsx",
    ).matchAll(/from "\.\/data-table-cell-([\w-]+)"/g),
  ).map((match) => match[1]),
);

/** Every block a `npx shadcn@latest add` command installs, in order. */
function installCommands(source: string): string[][] {
  // Commands span lines with trailing backslashes, in fences and in prose.
  const normalized = source.replace(/\\\r?\n\s*/g, " ");

  return Array.from(normalized.matchAll(/npx shadcn@latest add ([^\n`]+)/g))
    .map((match) =>
      Array.from(match[1].matchAll(/\/r\/([\w-]+)\.json/g)).map(
        (url) => url[1],
      ),
    )
    .filter((blocks) => blocks.length > 0);
}

describe("registry urls in agent-facing docs", () => {
  it.each(INSTALL_DOC_FILES)("only names real blocks in %s", (file) => {
    const referenced = Array.from(read(file).matchAll(/\/r\/([\w-]+)\.json/g))
      .map((match) => match[1])
      .filter((name) => !NOT_A_BLOCK.has(name));

    expect(referenced.length).toBeGreaterThan(0);
    for (const name of referenced) {
      expect(blockNames, `${file} links /r/${name}.json`).toContain(name);
    }
  });

  it.each(INSTALL_DOC_FILES)(
    "only spells out canonical recipes in %s",
    (file) => {
      const recipes = RECIPES.map((recipe) => recipe.blocks.join(" "));

      for (const blocks of installCommands(read(file))) {
        // A one-block command is just "install this block"; a combination is a
        // recipe, and has to be one an agent can also find in llms.txt.
        if (blocks.length < 2) continue;
        expect(recipes, `${file} installs ${blocks.join(" + ")}`).toContain(
          blocks.join(" "),
        );
      }
    },
  );

  it("documents the whole catalog in README, the skill, and the Quick Start", () => {
    // The block count drifted three ways (10 / 11 / 13) before this pinned it.
    for (const file of [
      "README.md",
      "skills/data-table-filters/SKILL.md",
      "apps/web/src/content/docs/01-quick-start.mdx",
    ]) {
      const source = read(file);
      for (const name of blockNames) {
        expect(source, `${file} lists ${name}`).toContain(`/r/${name}.json`);
      }
    }
  });
});

describe("the component library line", () => {
  // Which shadcn libraries the blocks install on is the first thing a stranger
  // needs — human or agent — and it has to arrive before the first install
  // command. It is the one sentence from blocks.ts, verbatim, so that
  // llms.txt, the MCP server, and every hand-written page say the same
  // searchable thing.

  /** The page as a reader meets it: mdx frontmatter (FAQ answers) stripped. */
  function body(file: string): string {
    return read(file).replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "");
  }

  it.each(INSTALL_DOC_FILES)("is stated verbatim in %s", (file) => {
    expect(body(file), `${file} carries PREREQUISITE`).toContain(PREREQUISITE);
  });

  it.each(INSTALL_DOC_FILES)(
    "comes before the first install command in %s",
    (file) => {
      const source = body(file);
      const firstInstall = source.indexOf("npx shadcn@latest add");

      expect(firstInstall, `${file} has an install command`).toBeGreaterThan(
        -1,
      );
      expect(source.indexOf(PREREQUISITE)).toBeLessThan(firstInstall);
    },
  );

  it("is what the skill's detect script tells the user to run", () => {
    expect(read("skills/data-table-filters/scripts/detect-stack.sh")).toContain(
      RADIX_INIT_COMMAND,
    );
  });
});

describe("the create-project command", () => {
  // `shadcn init <blocks> --name` is the one-command path from nothing to a
  // rendered table. It is the sentence from blocks.ts, verbatim, on every
  // surface that also carries the two-step path, so a CLI flag change is a
  // one-line fix rather than a hunt.

  const CREATE_DOC_FILES = [
    "README.md",
    "AGENTS.md",
    ".cursor/rules/data-table-filters.mdc",
    "skills/data-table-filters/SKILL.md",
    "apps/web/src/content/docs/01-quick-start.mdx",
  ] as const;

  it.each(CREATE_DOC_FILES)("is stated verbatim in %s", (file) => {
    expect(read(file), `${file} carries CREATE_PROJECT_COMMAND`).toContain(
      CREATE_PROJECT_COMMAND,
    );
  });

  it("installs the Quick Start's two blocks, which are a canonical recipe", () => {
    const blocks = Array.from(
      CREATE_PROJECT_COMMAND.matchAll(/\/r\/([\w-]+)\.json/g),
    ).map((match) => match[1]);

    expect(blocks).toEqual(QUICK_START_BLOCKS);
    expect(RECIPES.map((recipe) => recipe.blocks.join(" "))).toContain(
      blocks.join(" "),
    );
    for (const name of blocks) {
      expect(blockNames).toContain(name);
    }
  });

  it("is the same two blocks the Quick Start's install command names", () => {
    const [firstInstall] = installCommands(
      read("apps/web/src/content/docs/01-quick-start.mdx"),
    );
    expect(firstInstall).toEqual(QUICK_START_BLOCKS);
  });

  it("scaffolds a Next.js app on a named preset, not with -d", () => {
    // shadcn 4.21.0 with `--name` and `-d` writes the pre-v4 `new-york` style;
    // `--template next -p nova` writes `base-nova`, the CLI default.
    expect(CREATE_PROJECT_COMMAND).toMatch(/^npx shadcn@latest init /);
    expect(CREATE_PROJECT_COMMAND).toContain("--name my-app");
    expect(CREATE_PROJECT_COMMAND).toContain("--template next");
    expect(CREATE_PROJECT_COMMAND).toContain("-p nova");
    expect(CREATE_PROJECT_COMMAND).not.toMatch(/\s-d(\s|$)/);
  });
});

describe("counts claimed in prose", () => {
  it.each(AGENT_FACING_FILES)("matches the manifest in %s", (file) => {
    const lines = read(file).split("\n");

    for (const line of lines) {
      const claim = line.match(/(\d+) files/);
      if (!claim) continue;

      const blocks = Array.from(line.matchAll(/\/r\/([\w-]+)\.json/g)).map(
        (match) => match[1],
      );
      expect(blocks, `"${claim[0]}" in ${file} names its block`).toHaveLength(
        1,
      );
      expect(Number(claim[1]), `${blocks[0]} file count in ${file}`).toBe(
        filesByBlock.get(blocks[0]),
      );
    }
  });

  it.each(AGENT_FACING_FILES)(
    "counts and names the cell renderers correctly in %s",
    (file) => {
      // Prose enumerates the renderers as `12 cell renderers (text, code, …)`.
      // Both halves are checked: the count against the barrel file, and every
      // listed name against the files — a phantom "custom" renderer shipped in
      // the skill because nothing checked the second half.
      const claims = Array.from(
        read(file).matchAll(
          /(\d+) cell (?:renderers|components) \(([^)]+)\)/gi,
        ),
      );

      for (const [claim, count, list] of claims) {
        expect(Number(count), `"${claim}" in ${file}`).toBe(
          cellRenderers.length,
        );

        const named = list.split(",").map((name) => name.trim());
        expect(named, `the list in ${file} is complete`).toHaveLength(
          cellRenderers.length,
        );
        for (const name of named) {
          expect(
            cellRendererSlugs,
            `${file} names a "${name}" renderer`,
          ).toContain(name);
        }
      }
    },
  );

  it.each(AGENT_FACING_FILES)("counts the blocks correctly in %s", (file) => {
    for (const [claim, count] of read(file).matchAll(
      /(\d+) shadcn registry blocks/gi,
    )) {
      expect(Number(count), `"${claim}" in ${file}`).toBe(registryItems.length);
    }
  });

  it("lists every renderer in the two catalogs", () => {
    for (const file of [
      "skills/data-table-filters/references/component-catalog.md",
      "apps/web/src/content/docs/04-ui-components.mdx",
    ]) {
      const source = read(file);
      for (const renderer of cellRenderers) {
        expect(source, `${file} documents ${renderer}`).toContain(renderer);
      }
    }
  });
});

describe("claude code plugin manifests", () => {
  const plugin = JSON.parse(read(".claude-plugin/plugin.json"));
  const marketplace = JSON.parse(read(".claude-plugin/marketplace.json"));
  const entry = marketplace.plugins.find(
    (item: { name: string }) => item.name === plugin.name,
  );

  it("lists the plugin in the marketplace", () => {
    expect(entry).toBeDefined();
  });

  it("agrees on the fields both files repeat", () => {
    for (const field of [
      "description",
      "version",
      "homepage",
      "license",
      "author",
    ] as const) {
      expect(entry[field], `marketplace ${field}`).toEqual(plugin[field]);
    }
  });

  it("ships the skill the plugin points at", () => {
    const skills = plugin.skills.replace(/^\.\//, "");
    expect(read(`${skills}/data-table-filters/SKILL.md`)).toContain(
      "name: data-table-filters",
    );
  });
});

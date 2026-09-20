import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import styles from "../src/lib/__fixtures__/shadcn-styles.json";
import { getRadiusClassName } from "../src/lib/style";
import {
  cleanupProject,
  installBlocks,
  materializeRegistry,
  npmInstall,
  prepareProject,
  typecheck,
  type CommandResult,
} from "./harness";

/**
 * Installs the blocks that read the style (`lib/style.ts` mines the user's
 * `buttonVariants`) under every `shadcn init -p base-<style>`, and checks two
 * things the vendored class strings in `style.styles.test.ts` cannot: that each
 * style's ui components still export what the blocks import, and that the
 * fixture those unit tests run on still matches what the CLI writes.
 *
 * An npm install per style, so opt in:
 * `REGISTRY_E2E_STYLES=1 pnpm --filter @dtf/registry test e2e/styles`.
 * `E2E_STYLE=lyra` narrows it to one.
 */
const enabled = process.env.REGISTRY_E2E_STYLES === "1";
const only = process.env.E2E_STYLE;

const BLOCKS = [
  "data-table",
  "data-table-filter-command",
  "data-table-cell",
  "data-table-sheet",
];

const STYLES = Object.keys(styles).filter((style) => !only || style === only);

describe.skipIf(!enabled)("registry install per shadcn style", () => {
  let localRegistry: ReturnType<typeof materializeRegistry>;

  beforeAll(() => {
    localRegistry = materializeRegistry();
  });

  afterAll(() => {
    localRegistry?.cleanup();
  });

  describe.each(STYLES)("base-%s", (style) => {
    let project: string;
    let deps: CommandResult;

    beforeAll(() => {
      project = prepareProject("next-src-base");
      const config = join(project, "components.json");
      writeFileSync(
        config,
        JSON.stringify(
          {
            ...JSON.parse(readFileSync(config, "utf8")),
            style: `base-${style}`,
          },
          null,
          2,
        ),
      );

      const install = installBlocks(project, BLOCKS, localRegistry.dir);
      expect(install.status, `shadcn add failed:\n${install.output}`).toBe(0);
      deps = npmInstall(project);
    }, 1_800_000);

    afterAll(() => {
      if (project) cleanupProject(project);
    });

    it("installs the style's own button, matching the vendored fixture", () => {
      const button = readFileSync(
        join(project, "src/components/ui/button.tsx"),
        "utf8",
      );
      expect(button).toMatch(/export \{[^}]*\bbuttonVariants\b/);
      const expected = getRadiusClassName(
        styles[style as keyof typeof styles].outlineButton,
      );
      expect(button).toContain(expected);
    });

    it("ships the style helper with the core block", () => {
      const helper = readFileSync(join(project, "src/lib/style.ts"), "utf8");
      expect(helper).toContain('from "@/components/ui/button"');
    });

    it("typechecks", () => {
      expect(deps.status, `npm install failed:\n${deps.output}`).toBe(0);
      const result = typecheck(project);
      expect(result.status, result.output).toBe(0);
    }, 900_000);
  });
});

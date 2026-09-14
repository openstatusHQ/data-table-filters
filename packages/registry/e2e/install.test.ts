import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import registry from "../registry.json";
import {
  addedFiles,
  cleanupProject,
  clobberedFiles,
  expectedFilesFor,
  installBlocks,
  materializeRegistry,
  npmInstall,
  prepareProject,
  quickStartBlocks,
  quickStartSample,
  scatteredGroups,
  snapshot,
  typecheck,
} from "./harness";

/**
 * Installs the blocks into throwaway apps with the real shadcn CLI and checks
 * that what lands there compiles.
 *
 * `registry.test.ts` asserts the manifest is internally consistent; these tests
 * assert what a user actually experiences — alias rewriting, the files the CLI
 * decides to write, the npm versions it resolves, and whether the result
 * typechecks. Slow (an npm install per case), so opt in with
 * `REGISTRY_E2E=1 pnpm --filter @dtf/registry test`.
 */
const enabled = process.env.REGISTRY_E2E === "1";

const CORE = ["data-table"];
const LARGE_TABLE = [
  "data-table",
  "data-table-schema",
  "data-table-cell",
  "data-table-sheet",
  "data-table-drizzle",
  "data-table-query",
  "data-table-nuqs",
];

type Fixture = {
  /** Directory under `e2e/fixtures`. */
  name: string;
  /** Roots the fixture's aliases point at, relative to the project. */
  allowedRoots: string[];
  /** Where the Quick Start paste goes. */
  page: string;
};

const FIXTURES: Fixture[] = [
  {
    name: "next-src",
    allowedRoots: ["src/"],
    page: "src/app/page.tsx",
  },
  {
    name: "next-no-src",
    allowedRoots: ["components/", "lib/", "hooks/"],
    page: "app/page.tsx",
  },
];

/** `components.json` style `base-nova`: the shadcn CLI default since v4. */
const BASE_UI_FIXTURE: Fixture = {
  name: "next-src-base",
  allowedRoots: ["src/"],
  page: "src/app/page.tsx",
};

type Case = {
  fixture: Fixture;
  blocks: string[];
  label: string;
  /** Written into `fixture.page` after the install, before the typecheck. */
  paste?: string;
};

/**
 * What the Quick Start tells a stranger to do: its one install command, then
 * its one paste. Both come from the page itself, so this is the case that
 * catches the docs and the blocks drifting apart — and the one that catches
 * the shadcn CLI changing its defaults under us, since the scheduled run
 * tracks the latest CLI.
 */
const QUICK_START: Omit<Case, "fixture"> = {
  blocks: quickStartBlocks(),
  label: "quick-start",
  paste: quickStartSample(),
};

const ALL_CASES: Case[] = [
  ...FIXTURES.flatMap((fixture) => [
    { fixture, blocks: CORE, label: "core" },
    { fixture, blocks: LARGE_TABLE, label: "large-table" },
  ]),
  { fixture: FIXTURES[0], ...QUICK_START },
  { fixture: BASE_UI_FIXTURE, ...QUICK_START },
  // The Quick Start's two blocks already reach the sheet and the cells through
  // registryDependencies, but the large table is where the most files land on
  // a library the source isn't written in — the case that would catch the CLI
  // changing how it translates `asChild` on its way into a Base UI project.
  { fixture: BASE_UI_FIXTURE, blocks: LARGE_TABLE, label: "large-table" },
];

/**
 * `E2E_CASE=next-src:core` runs one case, so CI can fan the matrix out across
 * jobs instead of paying for every npm install in sequence.
 */
const selected = process.env.E2E_CASE;
const matches = (entry: Case) =>
  !selected || `${entry.fixture.name}:${entry.label}` === selected;
const CASES = ALL_CASES.filter(matches);

if (enabled && CASES.length === 0) {
  throw new Error(
    `E2E_CASE="${selected}" matched no case. Available: ${ALL_CASES.map(
      (entry) => `${entry.fixture.name}:${entry.label}`,
    ).join(", ")}`,
  );
}

/**
 * `--overwrite` is the only way to get a complete install (see `installBlocks`),
 * and it necessarily rewrites the one file the blocks share with every shadcn
 * project. Anything else it touches is a defect.
 */
const OVERWRITTEN_BY_DESIGN = ["lib/utils.ts"];

describe.skipIf(!enabled)("registry install", () => {
  let localRegistry: ReturnType<typeof materializeRegistry>;

  beforeAll(() => {
    localRegistry = materializeRegistry();
  });

  afterAll(() => {
    localRegistry?.cleanup();
  });

  describe.each(CASES)(
    "$fixture.name / $label",
    ({ fixture, blocks, paste }) => {
      let project: string;
      let installed: string[];
      let before: Map<string, string>;
      let after: Map<string, string>;

      beforeAll(() => {
        project = prepareProject(fixture.name);
        before = snapshot(project);

        const install = installBlocks(project, blocks, localRegistry.dir);
        expect(install.status, `shadcn add failed:\n${install.output}`).toBe(0);

        after = snapshot(project);
        installed = addedFiles(before, after);
      }, 900_000);

      afterAll(() => {
        if (project) cleanupProject(project);
      });

      it("touches no pre-existing file except the shared utils helper", () => {
        const unexpected = clobberedFiles(before, after).filter(
          (entry) =>
            !OVERWRITTEN_BY_DESIGN.some((allowed) => entry.includes(allowed)),
        );

        expect(unexpected).toEqual([]);
      });

      it("keeps every declared directory intact", () => {
        // The whole tree, not just what the install added — a block may legitimately
        // land on a file the fixture already had (`lib/utils.ts`), and that file is
        // still part of the directory arriving intact.
        expect(
          scatteredGroups(expectedFilesFor(registry.items, blocks), [
            ...after.keys(),
          ]),
        ).toEqual([]);
      });

      it("writes nothing outside the directories the aliases point at", () => {
        const allowed = [
          ...fixture.allowedRoots,
          "package.json",
          "package-lock.json",
        ];

        const stray = installed.filter(
          (path) =>
            !allowed.some((root) =>
              root.endsWith("/") ? path.startsWith(root) : path === root,
            ),
        );

        expect(stray).toEqual([]);
      });

      it("typechecks", () => {
        if (paste) writeFileSync(join(project, fixture.page), paste);

        const install = npmInstall(project);
        expect(install.status, `npm install failed:\n${install.output}`).toBe(
          0,
        );

        const result = typecheck(project);
        expect(result.status, `tsc reported errors:\n${result.output}`).toBe(0);
      }, 900_000);
    },
  );

  // What an agent actually runs: `npx shadcn add <url> --yes`, no TTY, no
  // `--overwrite` — because overwriting the user's files uninvited is not an
  // option. The blocks ship `src/lib/utils.ts`, every shadcn project already has
  // it, so the CLI stops to ask, gets no answer, and abandons the rest of the
  // batch while still exiting 0. The result is a half-installed tree and a build
  // full of "Cannot find module" errors.
  //
  // `it.fails` pins the defect: the day the install comes through whole, this
  // test goes red and should be promoted into the matrix above.
  describe("agent-style install (no --overwrite, non-interactive)", () => {
    let project: string;

    afterAll(() => {
      if (project) cleanupProject(project);
    });

    it.fails(
      "installs every declared file",
      () => {
        project = prepareProject("next-src");
        const before = snapshot(project);

        const install = installBlocks(project, CORE, localRegistry.dir, {
          overwrite: false,
        });
        expect(install.status).toBe(0);

        const installed = addedFiles(before, snapshot(project));
        expect(
          scatteredGroups(expectedFilesFor(registry.items, CORE), installed),
        ).toEqual([]);
      },
      900_000,
    );
  });
});

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import registry from "../registry.json";
import {
  addedFiles,
  build,
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
  type CommandResult,
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
  // a library the source isn't written in. It pastes nothing, so it typechecks
  // rather than builds: the blocks it adds beyond the Quick Start's two (query,
  // nuqs, drizzle) need providers and a database around them before a route
  // could render, which is more fixture than the coverage is worth. The CLI's
  // `asChild` translation is covered on this case without a render, by reading
  // the installed source.
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
 * Files an install may legitimately rewrite. Since the core block stopped
 * shipping `lib/utils.ts` there are none: the blocks share no path with a
 * fresh shadcn project, so anything the install touches is a defect.
 */
const OVERWRITTEN_BY_DESIGN: string[] = [];

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
      let deps: CommandResult | undefined;

      // Asserted by the tests that need `node_modules`, not by the hook that
      // runs it. A registry flake during `npm install` should fail those two
      // and leave the file-placement assertions — which read the snapshots
      // taken above, before the install — reporting their own signal.
      const expectDependencies = () =>
        expect(deps?.status, `npm install failed:\n${deps?.output}`).toBe(0);

      beforeAll(() => {
        project = prepareProject(fixture.name);
        before = snapshot(project);

        const install = installBlocks(project, blocks, localRegistry.dir);
        expect(install.status, `shadcn add failed:\n${install.output}`).toBe(0);

        after = snapshot(project);
        installed = addedFiles(before, after);
      }, 900_000);

      // Second hook on purpose: the snapshots above have to be taken before
      // the paste, or the file-placement assertions read a rewritten
      // `page.tsx` as the install touching a pre-existing file.
      beforeAll(() => {
        if (paste) writeFileSync(join(project, fixture.page), paste);

        deps = npmInstall(project);
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

      // The one defect in this PR's class that nothing else here can see.
      // `SortableOverlay` passes `asChild` as a spread rather than a literal
      // because the CLI rewrites a literal `asChild` into `render` on its way
      // into a Base UI project, and drops it where the child is an expression
      // — silently turning the drag overlay into a wrapper div. The typecheck
      // stays green either way (`SortableItem` accepts both props), and the
      // build test cannot reach it: the overlay renders through a portal only
      // while a drag is active, so it is never in the prerendered HTML. So
      // read the installed source. If a future CLI learns to rewrite spreads
      // too, this is the assertion that says so.
      it("keeps the drag overlay's asChild through the CLI's codemod", () => {
        const path = installed.find((entry) =>
          entry.endsWith("custom/sortable.tsx"),
        );
        expect(
          path,
          `custom/sortable.tsx was not installed:\n${installed.join("\n")}`,
        ).toBeDefined();

        const source = readFileSync(join(project, path as string), "utf8");
        const overlay = source.indexOf("function SortableOverlay");
        expect(
          overlay,
          "SortableOverlay is gone from the installed file",
        ).toBeGreaterThan(-1);

        const item = source.indexOf("<SortableItem", overlay);
        expect(
          item,
          "the overlay no longer renders a SortableItem",
        ).toBeGreaterThan(-1);

        // The opening tag only — `asChild` anywhere else in the file proves
        // nothing about the overlay.
        const tag = source.slice(item, source.indexOf(">", item));
        expect(
          /asChild|render=/.test(tag),
          `the overlay's SortableItem lost its asChild:\n${tag}`,
        ).toBe(true);
      });

      it("typechecks", () => {
        expectDependencies();

        const result = typecheck(project);
        expect(result.status, `tsc reported errors:\n${result.output}`).toBe(0);
      }, 900_000);

      // Only the cases that paste real usage into a route. Next bundles what
      // the routes import, so building a project where nothing imports the
      // blocks would compile an empty app and prove nothing.
      it.skipIf(!paste)(
        "builds, and prerenders the table",
        () => {
          expectDependencies();

          const result = build(project);
          expect(result.status, `next build failed:\n${result.output}`).toBe(0);

          // Exiting 0 is not the point: the prerendered HTML is the proof that
          // the blocks' render path ran on the server against this project's
          // primitives. Read off the artifact rather than the build's stdout,
          // which changes shape between Next versions. The accordion is the
          // marker because the block ships its own — the filter sidebar is
          // where the two libraries diverge past a prop name.
          const page = join(project, ".next", "server", "app", "index.html");
          expect(existsSync(page), `${page} was not prerendered`).toBe(true);
          expect(readFileSync(page, "utf8")).toContain('data-slot="accordion"');
        },
        900_000,
      );
    },
  );

  // What an agent actually runs: `npx shadcn add <url> --yes`, no TTY, no
  // `--overwrite` — because overwriting the user's files uninvited is not an
  // option. This used to be pinned as an expected failure: the core block
  // shipped `src/lib/utils.ts`, every shadcn project already has it, so the CLI
  // stopped to ask, got no answer, and abandoned the rest of the batch while
  // exiting 0 — a half-installed tree and a build full of "Cannot find module".
  // The block now leaves that file to shadcn's own `utils` item, so the
  // non-interactive install has to come through whole and touch nothing.
  describe("agent-style install (no --overwrite, non-interactive)", () => {
    let project: string;

    afterAll(() => {
      if (project) cleanupProject(project);
    });

    it("installs every declared file and leaves the project's own files alone", () => {
      project = prepareProject("next-src");
      const before = snapshot(project);

      const install = installBlocks(project, CORE, localRegistry.dir, {
        overwrite: false,
      });
      expect(install.status, `shadcn add failed:\n${install.output}`).toBe(0);

      const after = snapshot(project);
      expect(
        scatteredGroups(
          expectedFilesFor(registry.items, CORE),
          addedFiles(before, after),
        ),
      ).toEqual([]);
      expect(clobberedFiles(before, after)).toEqual([]);
      expect(
        readFileSync(join(project, "src/lib/utils.ts"), "utf8"),
        "the consumer's utils.ts, sentinel included, survives",
      ).toContain("FIXTURE_SENTINEL");
    }, 900_000);
  });
});

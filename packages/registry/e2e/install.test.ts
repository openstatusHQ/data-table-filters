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
  /**
   * Which primitives `components.json` makes the CLI resolve `tooltip`,
   * `accordion`, `dialog` … from. The blocks are written against Radix; on
   * Base UI (`style: "base-nova"`, the CLI default since shadcn v4) they
   * install but do not typecheck.
   */
  library: "radix" | "base";
};

const FIXTURES: Fixture[] = [
  {
    name: "next-src",
    allowedRoots: ["src/"],
    page: "src/app/page.tsx",
    library: "radix",
  },
  {
    name: "next-no-src",
    allowedRoots: ["components/", "lib/", "hooks/"],
    page: "app/page.tsx",
    library: "radix",
  },
];

const BASE_UI_FIXTURE: Fixture = {
  name: "next-src-base",
  allowedRoots: ["src/"],
  page: "src/app/page.tsx",
  library: "base",
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
];

/** The cases that must pass; the Base UI case is pinned separately below. */
const PASSING_CASES = ALL_CASES.filter(
  (entry) => entry.fixture.library === "radix",
);

/**
 * `E2E_CASE=next-src:core` runs one case, so CI can fan the matrix out across
 * jobs instead of paying for every npm install in sequence.
 */
const selected = process.env.E2E_CASE;
const matches = (entry: Case) =>
  !selected || `${entry.fixture.name}:${entry.label}` === selected;
const CASES = PASSING_CASES.filter(matches);
const PINNED_CASES = ALL_CASES.filter(
  (entry) => entry.fixture.library === "base" && matches(entry),
);

if (enabled && CASES.length === 0 && PINNED_CASES.length === 0) {
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

  // The shadcn CLI default since v4 (`init -d`, style `base-nova`) resolves
  // the blocks' `tooltip`, `accordion`, `dialog` … from Base UI, and the blocks
  // are written against Radix. This case asserts the *specific* way that
  // fails today, so an unrelated regression on the base row still goes red,
  // and so does the day a Base UI port (or dual-shipped ui/ primitives) makes
  // the whole path pass — the signal to take the Radix prerequisite off every
  // install surface (README, Quick Start, SKILL.md, llms.txt, get_install_plan).
  //
  // Two shapes, depending on the package manager the CLI picks:
  //
  // - npm (no lockfile, as create-next-app leaves it) with the blocks still on
  //   `date-fns@^3`: `shadcn add` exits 1 at "Installing dependencies", an
  //   ERESOLVE against `@base-ui/react`'s `date-fns@^4` peer. Goes away once
  //   the date-fns v4 bump (#107) lands, after which only the second shape is
  //   left;
  // - the install lands and every file arrives, but tsc rejects Radix-only
  //   props: `delayDuration` (TooltipProvider), `render` (DialogClose), `type`
  //   (Accordion), `openDelay` (HoverCard).
  const RADIX_ONLY_PROPS =
    /delayDuration|openDelay|Property 'render'|Property 'type'/;

  describe.each(PINNED_CASES)(
    "$fixture.name / $label (shadcn default, pinned failure)",
    ({ fixture, blocks, paste }) => {
      let project: string;

      afterAll(() => {
        if (project) cleanupProject(project);
      });

      it("fails the documented way, and no other", () => {
        project = prepareProject(fixture.name);

        const install = installBlocks(project, blocks, localRegistry.dir);
        if (install.status !== 0) {
          expect(
            install.output,
            `shadcn add failed for a reason other than the date-fns peer conflict:\n${install.output}`,
          ).toMatch(/ERESOLVE[\s\S]*date-fns/);
          return;
        }

        expect(
          scatteredGroups(expectedFilesFor(registry.items, blocks), [
            ...snapshot(project).keys(),
          ]),
        ).toEqual([]);

        if (paste) writeFileSync(join(project, fixture.page), paste);

        const deps = npmInstall(project);
        expect(deps.status, `npm install failed:\n${deps.output}`).toBe(0);

        const result = typecheck(project);
        expect(
          result.status,
          "the blocks typecheck on Base UI — remove the Radix prerequisite from every install surface and promote this case into the matrix above",
        ).not.toBe(0);
        expect(
          result.output,
          `tsc failed for a reason other than Radix-only props:\n${result.output}`,
        ).toMatch(RADIX_ONLY_PROPS);
      }, 1_800_000);
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

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export const REGISTRY_ROOT = resolve(here, "..");
export const FIXTURES_DIR = join(here, "fixtures");
export const PRODUCTION_BASE = "https://data-table.openstatus.dev";

/**
 * Materializes this working tree's built registry as local JSON files, with the
 * absolute production URLs in `registryDependencies` rewritten to point at the
 * copies.
 *
 * Without the rewrite, installing a local block would pull its dependencies
 * from production, so a PR that breaks the dependency graph would still pass.
 *
 * Local paths rather than a localhost server on purpose: shadcn 4.16.2 ignores
 * `http://` item addresses outright — it exits 0 having written nothing and
 * without ever issuing a request — so a server-based harness silently tests
 * nothing at all.
 */
export function materializeRegistry(): { dir: string; cleanup: () => void } {
  const registryDir = join(REGISTRY_ROOT, "public", "r");
  if (!existsSync(registryDir)) {
    throw new Error(
      `No built registry at ${registryDir}. Run \`pnpm registry:build\` first.`,
    );
  }

  const dir = mkdtempSync(join(tmpdir(), "dtf-registry-"));

  for (const entry of readdirSync(registryDir)) {
    if (!entry.endsWith(".json")) continue;
    writeFileSync(
      join(dir, entry),
      readFileSync(join(registryDir, entry), "utf8")
        .split(`${PRODUCTION_BASE}/r/`)
        .join(`${dir}/`),
    );
  }

  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

/** Copies a fixture into a scratch directory that the test owns. */
export function prepareProject(fixture: string): string {
  const source = join(FIXTURES_DIR, fixture);
  if (!existsSync(source)) throw new Error(`Unknown fixture: ${fixture}`);

  const target = mkdtempSync(join(tmpdir(), `dtf-e2e-${fixture}-`));
  cpSync(source, target, { recursive: true });
  return target;
}

export function cleanupProject(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}

const IGNORED_DIRECTORIES = new Set([
  "node_modules",
  ".next",
  ".git",
  ".turbo",
]);

/** Content hash of every file in the project, keyed by relative path. */
export function snapshot(dir: string): Map<string, string> {
  const hashes = new Map<string, string>();

  const walk = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (IGNORED_DIRECTORIES.has(entry.name)) continue;
        walk(join(current, entry.name));
        continue;
      }
      const absolute = join(current, entry.name);
      if (!statSync(absolute).isFile()) continue;
      hashes.set(
        relative(dir, absolute),
        createHash("sha256").update(readFileSync(absolute)).digest("hex"),
      );
    }
  };

  walk(dir);
  return hashes;
}

export type CommandResult = {
  status: number;
  stdout: string;
  stderr: string;
  output: string;
};

function run(
  command: string,
  args: string[],
  cwd: string,
  timeout: number,
): CommandResult {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    timeout,
    env: { ...process.env, CI: "1", NEXT_TELEMETRY_DISABLED: "1" },
  });

  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";

  return {
    status: result.status ?? 1,
    stdout,
    stderr,
    output: `${stdout}\n${stderr}`.trim(),
  };
}

/**
 * `shadcn add` against the materialized registry.
 *
 * `--overwrite` is required to get a *complete* install: the blocks ship
 * `src/lib/utils.ts`, which exists in every shadcn project, and without the flag
 * the CLI stops to ask about it. On a non-TTY stdin that prompt gets no answer,
 * and the CLI abandons the rest of the write batch — exiting 0 having written 43
 * of 55 files. Pass `{ overwrite: false }` to reproduce that; the "agent-style
 * install" case in `install.test.ts` pins it.
 *
 * Pinned by default so CI is deterministic; set `SHADCN_VERSION=latest` in a
 * scheduled run to find out when a new CLI release breaks the blocks.
 */
export const SHADCN_VERSION = process.env.SHADCN_VERSION ?? "4.16.2";

export function installBlocks(
  dir: string,
  blocks: string[],
  registryDir: string,
  { overwrite = true }: { overwrite?: boolean } = {},
): CommandResult {
  const items = blocks.map((block) => join(registryDir, `${block}.json`));
  return run(
    "npx",
    [
      "--yes",
      `shadcn@${SHADCN_VERSION}`,
      "add",
      ...items,
      "--yes",
      ...(overwrite ? ["--overwrite"] : []),
    ],
    dir,
    900_000,
  );
}

export function npmInstall(dir: string): CommandResult {
  return run("npm", ["install", "--no-audit", "--no-fund"], dir, 600_000);
}

export function typecheck(dir: string): CommandResult {
  return run("npx", ["--yes", "tsc", "--noEmit"], dir, 600_000);
}

/**
 * Files a fixture legitimately hands over to the installer: dependency
 * manifests, and the stylesheet the CLI injects CSS variables into.
 */
const MUTABLE_BY_INSTALL = new Set([
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lockb",
]);

export function isMutableByInstall(path: string): boolean {
  return MUTABLE_BY_INSTALL.has(path) || path.endsWith("globals.css");
}

/** Paths present before the install whose contents the install changed. */
export function clobberedFiles(
  before: Map<string, string>,
  after: Map<string, string>,
): string[] {
  const clobbered: string[] = [];

  for (const [path, hash] of before) {
    if (isMutableByInstall(path)) continue;
    const next = after.get(path);
    if (next === undefined) {
      clobbered.push(`${path} (deleted)`);
      continue;
    }
    if (next !== hash) clobbered.push(`${path} (modified)`);
  }

  return clobbered;
}

/** Paths the install created. */
export function addedFiles(
  before: Map<string, string>,
  after: Map<string, string>,
): string[] {
  return [...after.keys()].filter((path) => !before.has(path)).sort();
}

type RegistryItem = {
  name: string;
  files?: { path: string; target?: string }[];
  registryDependencies?: string[];
};

/**
 * Declared directories whose files did not land together in one directory.
 *
 * Asserting exact destinations would mean reimplementing shadcn's alias
 * resolution, which is version-specific and moves files between roots — it puts
 * `src/providers/controls.tsx` in `components/`, and `src/react-table.d.ts` in
 * `lib/`. What matters instead is that a declared directory arrives intact
 * somewhere: that catches both dropped files and the flattening reported in #79,
 * without pinning the harness to one CLI release.
 */
export function scatteredGroups(
  declared: string[],
  installed: string[],
): string[] {
  const installedSet = new Set(installed);
  const installedDirs = new Set(installed.map((path) => dirname(path)));

  const groups = new Map<string, string[]>();
  for (const path of declared) {
    const dir = dirname(path);
    groups.set(dir, [...(groups.get(dir) ?? []), basename(path)]);
  }

  const scattered: string[] = [];
  for (const [dir, names] of groups) {
    const landed = [...installedDirs].filter((candidate) =>
      names.every((name) => installedSet.has(join(candidate, name))),
    );
    if (landed.length === 0) {
      const absent = names.filter(
        (name) =>
          ![...installedDirs].some((d) => installedSet.has(join(d, name))),
      );
      scattered.push(
        `${dir}/ did not arrive intact${absent.length ? ` (never written: ${absent.join(", ")})` : " (split across directories)"}`,
      );
    }
  }

  return scattered;
}

/**
 * The registry file paths a block install is expected to produce, following
 * this registry's own dependencies (shadcn's bare components are excluded — the
 * fixture assertions only cover files we ship).
 */
export function expectedFilesFor(
  items: RegistryItem[],
  blocks: string[],
): string[] {
  const byName = new Map(items.map((item) => [item.name, item]));
  const paths = new Set<string>();
  const seen = new Set<string>();

  const visit = (name: string) => {
    if (seen.has(name)) return;
    seen.add(name);

    const item = byName.get(name);
    if (!item) return;

    for (const file of item.files ?? []) paths.add(file.path);

    for (const dep of item.registryDependencies ?? []) {
      const match = dep.match(/\/r\/([^/]+)\.json$/);
      if (match) visit(match[1]);
    }
  };

  for (const block of blocks) visit(block);
  return [...paths].sort();
}

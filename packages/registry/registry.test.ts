import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import registry from "./registry.json";

// Regression tests for issue #79 — registry blocks shipped a tree that could
// not typecheck because blocks imported modules no dependency provided.
//
// These assert packaging invariants against `registry.json` (the source of
// truth) rather than the built `public/r/*.json`, so they fail on the edit that
// introduces the problem instead of only after a rebuild.

const root = dirname(fileURLToPath(import.meta.url));

type RegistryFile = { path: string; type: string; target?: string };
type RegistryItem = {
  name: string;
  files?: RegistryFile[];
  registryDependencies?: string[];
  dependencies?: string[];
};

const items = registry.items as RegistryItem[];
const byName = new Map(items.map((item) => [item.name, item]));

const manifest = JSON.parse(
  readFileSync(join(root, "package.json"), "utf8"),
) as {
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

/** react/react-dom/next are the consumer's, not ours to install. */
const ambientPeers = new Set(["next", "react", "react-dom"]);

/**
 * The versions the blocks are typechecked against in this workspace.
 *
 * `nuqs` is a peer rather than a dependency so that this package and the app
 * resolve one instance of it — two copies mean two React contexts and
 * `<NuqsAdapter>` stops being visible to the store adapter. Consumers still
 * install it through the block, so its range is checked like any other.
 */
const workspaceRanges: Record<string, string> = {
  ...manifest.peerDependencies,
  ...manifest.dependencies,
};

/** `date-fns@^3.6.0` -> `date-fns`, `@dnd-kit/core@^6.3.1` -> `@dnd-kit/core`. */
function toPackageName(dependency: string): string {
  const separator = dependency.lastIndexOf("@");
  return separator > 0 ? dependency.slice(0, separator) : dependency;
}

/** The range half of a dependency entry, or null for a bare name. */
function toRangeOrNull(dependency: string): string | null {
  const separator = dependency.lastIndexOf("@");
  return separator > 0 ? dependency.slice(separator + 1) : null;
}

/** `https://data-table.openstatus.dev/r/data-table-cell.json` -> `data-table-cell` */
function toBlockName(dep: string): string | null {
  const match = dep.match(/\/r\/([^/]+)\.json$/);
  return match ? match[1] : null;
}

/** Strip `src/` and the extension so a path matches how it is imported. */
function toModuleId(path: string): string {
  return path.replace(/^src\//, "").replace(/\.(tsx|ts)$/, "");
}

/** Every module a block provides, following registryDependencies transitively. */
function resolveProvided(name: string, seen = new Set<string>()): Set<string> {
  const provided = new Set<string>();
  if (seen.has(name)) return provided;
  seen.add(name);

  const item = byName.get(name);
  if (!item) return provided;

  for (const file of item.files ?? []) provided.add(toModuleId(file.path));
  for (const dep of item.registryDependencies ?? []) {
    const blockName = toBlockName(dep);
    // Bare names are shadcn's own registry (button, input, …), not ours.
    if (!blockName) continue;
    for (const id of resolveProvided(blockName, seen)) provided.add(id);
  }
  return provided;
}

/**
 * Internal imports of a source file. Sources use the `@dtf/registry/` alias,
 * which `scripts/transform-imports.mjs` rewrites to `@/` at build time.
 */
function internalImports(filePath: string): string[] {
  const absolute = resolve(root, filePath);
  if (!existsSync(absolute)) return [];
  const content = readFileSync(absolute, "utf8");
  return [...content.matchAll(/from\s+"(?:@dtf\/registry|@)\/([^"]+)"/g)].map(
    (match) => match[1],
  );
}

/**
 * Relative imports of a source file, resolved to registry-root-relative module
 * ids (`src/lib/drizzle/interval.ts` -> `lib/drizzle/interval`).
 *
 * These are copied verbatim into a consumer's tree, so a relative import
 * pointing at a file the block does not ship installs code that cannot resolve.
 * The alias-based check below cannot see them.
 */
function relativeImports(filePath: string): string[] {
  const absolute = resolve(root, filePath);
  if (!existsSync(absolute)) return [];
  const content = stripComments(readFileSync(absolute, "utf8"));
  const specifiers = [
    ...content.matchAll(/from\s+"(\.[^"]*)"/g),
    ...content.matchAll(/import\(\s*"(\.[^"]*)"\s*\)/g),
  ].map((match) => match[1]);

  const fromDir = dirname(filePath);
  return specifiers.map((specifier) =>
    toModuleId(join(fromDir, specifier).replace(/\\/g, "/")),
  );
}

/** shadcn `init` writes `lib/utils.ts`, and `ui/*` comes from its registry. */
function isProvidedByShadcn(moduleId: string): boolean {
  return moduleId === "lib/utils" || moduleId.startsWith("components/ui/");
}

/**
 * npm packages that shadcn's own components install alongside themselves, keyed
 * by the bare registryDependency that pulls them in. A block that depends on
 * `command` gets `cmdk` without having to declare it.
 */
const SHADCN_PROVIDED_PACKAGES: Record<string, string[]> = {
  command: ["cmdk"],
  "react-day-picker": ["react-day-picker"],
  calendar: ["react-day-picker"],
  sonner: ["sonner"],
  drawer: ["vaul"],
  chart: ["recharts"],
};

/** Strip comments so a package named only in a JSDoc `@example` doesn't count. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** Bare npm package specifiers imported by a source file. */
function externalImports(filePath: string): string[] {
  const absolute = resolve(root, filePath);
  if (!existsSync(absolute)) return [];

  const content = stripComments(readFileSync(absolute, "utf8"));
  const specifiers = [
    ...content.matchAll(/from\s+"([^"]+)"/g),
    ...content.matchAll(/import\(\s*"([^"]+)"\s*\)/g),
  ].map((match) => match[1]);

  return specifiers
    .filter(
      (specifier) =>
        !specifier.startsWith(".") &&
        !specifier.startsWith("@/") &&
        !specifier.startsWith("@dtf/") &&
        !specifier.startsWith("node:"),
    )
    .map((specifier) => {
      const segments = specifier.split("/");
      return specifier.startsWith("@")
        ? segments.slice(0, 2).join("/")
        : segments[0];
    });
}

/** npm packages a block installs, following registryDependencies transitively. */
function resolveDependencies(
  name: string,
  seen = new Set<string>(),
): Set<string> {
  const packages = new Set<string>();
  if (seen.has(name)) return packages;
  seen.add(name);

  const item = byName.get(name);
  if (!item) return packages;

  for (const dependency of item.dependencies ?? [])
    packages.add(toPackageName(dependency));

  for (const dep of item.registryDependencies ?? []) {
    const blockName = toBlockName(dep);
    if (blockName) {
      for (const pkg of resolveDependencies(blockName, seen)) packages.add(pkg);
      continue;
    }
    // Bare name — a shadcn component, which brings its own npm packages.
    for (const pkg of SHADCN_PROVIDED_PACKAGES[dep] ?? []) packages.add(pkg);
  }

  return packages;
}

/** Only the packages shadcn's own components install, transitively. */
function resolveShadcnPackages(
  name: string,
  seen = new Set<string>(),
): Set<string> {
  const packages = new Set<string>();
  if (seen.has(name)) return packages;
  seen.add(name);

  for (const dep of byName.get(name)?.registryDependencies ?? []) {
    const blockName = toBlockName(dep);
    if (blockName) {
      for (const pkg of resolveShadcnPackages(blockName, seen))
        packages.add(pkg);
      continue;
    }
    for (const pkg of SHADCN_PROVIDED_PACKAGES[dep] ?? []) packages.add(pkg);
  }

  return packages;
}

describe("registry packaging", () => {
  it.each(items.map((item) => item.name))(
    "%s resolves every internal import from itself or its registryDependencies",
    (name) => {
      const provided = resolveProvided(name);
      const unresolved: string[] = [];

      for (const file of byName.get(name)?.files ?? []) {
        for (const moduleId of internalImports(file.path)) {
          if (isProvidedByShadcn(moduleId)) continue;
          if (provided.has(moduleId)) continue;
          if (provided.has(`${moduleId}/index`)) continue;
          unresolved.push(`${file.path} -> @/${moduleId}`);
        }
      }

      expect(unresolved).toEqual([]);
    },
  );

  it.each(items.map((item) => item.name))(
    "%s ships every file its relative imports point at",
    (name) => {
      // `interval.ts` was extracted out of a demo route into the drizzle block
      // and wired up with `./interval` imports, but never added to the manifest.
      // The block installed, then failed to resolve its own import. The
      // alias-based check above is blind to relative specifiers.
      const provided = resolveProvided(name);
      const unresolved: string[] = [];

      for (const file of byName.get(name)?.files ?? []) {
        for (const moduleId of relativeImports(file.path)) {
          if (provided.has(moduleId)) continue;
          if (provided.has(`${moduleId}/index`)) continue;
          unresolved.push(`${file.path} -> ${moduleId}`);
        }
      }

      expect(unresolved).toEqual([]);
    },
  );

  it.each(items.map((item) => item.name))(
    "%s declares every npm package it imports",
    (name) => {
      // The import-resolution test above covers `@/` imports; this covers the
      // other half of "installs but doesn't compile" — a bare package import
      // that no block, dependency, or shadcn component installs.
      const installed = resolveDependencies(name);
      const undeclared: string[] = [];

      for (const file of byName.get(name)?.files ?? []) {
        for (const pkg of externalImports(file.path)) {
          if (ambientPeers.has(pkg)) continue;
          if (installed.has(pkg)) continue;
          undeclared.push(`${file.path} -> ${pkg}`);
        }
      }

      expect(undeclared).toEqual([]);
    },
  );

  it("pins every dependency to the range its code is typechecked against", () => {
    // A bare name resolves to the latest major in the consumer's project:
    // `@tanstack/react-table` 9 against v8 code, `react-day-picker` 10 against
    // v9. The install exits 0 and the build is ~40 type errors, which is what
    // e2e/install.test.ts caught. The range has to match this workspace's own
    // package.json, because that is the only version the blocks are ever
    // compiled against — a bump here without a bump there ships code that
    // typechecks in CI and not in the consumer's app.
    const wrong = items.flatMap((item) =>
      (item.dependencies ?? []).flatMap((dependency) => {
        const name = toPackageName(dependency);
        const range = toRangeOrNull(dependency);
        const expected = workspaceRanges[name];

        if (!expected)
          return [`${item.name}: ${name} is not a dependency of this package`];
        if (!range) return [`${item.name}: ${name} needs @${expected}`];
        if (range !== expected)
          return [`${item.name}: ${name}@${range} should be @${expected}`];
        return [];
      }),
    );

    expect(wrong).toEqual([]);
  });

  it("leaves packages a shadcn component installs to that component", () => {
    // Declaring one of these is a range npm silently discards: the CLI writes
    // shadcn's own, and it wins. `calendar` installs react-day-picker 10, so a
    // `react-day-picker@^9` here bought nothing — the block's code still got
    // compiled against 10 in the consumer's project while CI compiled it
    // against 9, which is exactly the `initialFocus` break e2e caught.
    const conflicting = items.flatMap((item) => {
      const shadcnProvided = resolveShadcnPackages(item.name);
      return (item.dependencies ?? [])
        .map(toPackageName)
        .filter((name) => shadcnProvided.has(name))
        .map((name) => `${item.name}: ${name} comes from a shadcn component`);
    });

    expect(conflicting).toEqual([]);
  });

  it("keeps the shipped src/lib/utils.ts to the canonical `cn` helper", () => {
    // We ship `src/lib/utils.ts` on purpose, so every block's `@/lib/utils`
    // import resolves even in a project that never ran `shadcn init`. shadcn
    // prompts before overwriting (y/N, defaulting to N), so this is the
    // consumer's call to make — but it lands on a path they are likely to own.
    // Keeping the file identical to what `shadcn init` writes means saying yes
    // is a no-op. Adding an export here would start destroying their code.
    const shippers = items.filter((item) =>
      (item.files ?? []).some((file) => file.path === "src/lib/utils.ts"),
    );
    expect(shippers.length).toBeGreaterThan(0);

    const source = readFileSync(resolve(root, "src/lib/utils.ts"), "utf8");
    const exports = [
      ...source.matchAll(/^export\s+(?:function|const)\s+(\w+)/gm),
    ].map((match) => match[1]);

    expect(exports).toEqual(["cn"]);
  });

  it("ships no test scaffolding to consumers", () => {
    // Blocks are copy-in: every listed file lands in the consumer's `src/`.
    // The filter semantics now have a shared conformance corpus at
    // `src/lib/filters/testing/conformance.ts`, which sits inside the same
    // `src/lib/filters/` directory whose four other files DO ship — so it is one
    // careless glob away from being copied into every consumer project, where it
    // would import `vitest` and fail to compile.
    const shipped = items.flatMap((item) =>
      (item.files ?? [])
        .filter((file) =>
          /(^|\/)(testing|__tests__)\/|\.test\.(ts|tsx)$/.test(file.path),
        )
        .map((file) => `${item.name}: ${file.path}`),
    );

    expect(shipped).toEqual([]);
  });

  it("declares no devDependency as a block dependency", () => {
    // `@electric-sql/pglite` is the live example: it is how the SQL engine is
    // tested without a hosted Postgres, and it is a devDependency of this
    // package only. A block that listed it would make every consumer install a
    // 100MB WASM Postgres to render a table.
    const devOnly = new Set(
      Object.keys(manifest.devDependencies ?? {}).filter(
        (name) => !(name in workspaceRanges),
      ),
    );

    const leaked = items.flatMap((item) =>
      (item.dependencies ?? [])
        .map(toPackageName)
        .filter((name) => devOnly.has(name))
        .map((name) => `${item.name}: ${name} is a devDependency`),
    );

    expect(leaked).toEqual([]);
    // Pinned by name so this keeps testing something if pglite is ever moved
    // between dependency groups.
    expect(
      items.flatMap((item) =>
        (item.dependencies ?? [])
          .map(toPackageName)
          .filter((name) => name === "@electric-sql/pglite")
          .map((name) => `${item.name}: ${name}`),
      ),
    ).toEqual([]);
  });

  it("lists only files that exist on disk", () => {
    const missing = items.flatMap((item) =>
      (item.files ?? [])
        .filter((file) => !existsSync(resolve(root, file.path)))
        .map((file) => `${item.name}: ${file.path}`),
    );

    expect(missing).toEqual([]);
  });

  it("keeps the built output in public/r in sync with registry.json", () => {
    const stale = items.flatMap((item) => {
      const builtPath = join(root, "public", "r", `${item.name}.json`);
      if (!existsSync(builtPath)) return [`${item.name}: not built`];

      const built = JSON.parse(readFileSync(builtPath, "utf8")) as {
        files?: { path: string }[];
      };
      const expected = (item.files ?? []).map((file) => file.path).sort();
      const actual = (built.files ?? []).map((file) => file.path).sort();

      return expected.join("\n") === actual.join("\n")
        ? []
        : [`${item.name}: run \`pnpm registry:build\``];
    });

    expect(stale).toEqual([]);
  });
});

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import registry from "./registry.json";

// Regression tests for issue #79 — registry blocks shipped a tree that could
// not typecheck, and silently clobbered the consumer's `src/lib/utils.ts`.
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
};

const items = registry.items as RegistryItem[];
const byName = new Map(items.map((item) => [item.name, item]));

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

/** shadcn `init` writes `lib/utils.ts`, and `ui/*` comes from its registry. */
function isProvidedByShadcn(moduleId: string): boolean {
  return moduleId === "lib/utils" || moduleId.startsWith("components/ui/");
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

  it("never ships src/lib/utils.ts, which would overwrite the consumer's own", () => {
    // The block only needs `cn`, which shadcn `init` already puts there.
    // Shipping our copy replaces the file wholesale and deletes any exports
    // the consumer kept alongside `cn`.
    const offenders = items
      .filter((item) =>
        (item.files ?? []).some((file) => file.path === "src/lib/utils.ts"),
      )
      .map((item) => item.name);

    expect(offenders).toEqual([]);
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

#!/usr/bin/env node

/**
 * Reports whether `packages/registry/public/r/*.json` still matches the source
 * it was built from.
 *
 * The old check just asked "did anything under registry/src change?", which is
 * true for every registry commit — including the ones that *did* rebuild — so it
 * blocked unconditionally and no rebuild could clear it.
 *
 * `registry:build` only rewrites `@dtf/registry/` to `@/` (see
 * scripts/transform-imports.mjs) before shadcn inlines each file, so the built
 * `content` is byte-comparable against the transformed source. That makes an
 * exact staleness check cheap enough to run on every commit.
 *
 * Exits 1 with a list of offenders when a rebuild is owed, 0 otherwise.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REGISTRY_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../packages/registry",
);
const OUTPUT_DIR = join(REGISTRY_DIR, "public/r");

/** Mirrors the only rewrite `transform-imports.mjs` applies. */
function transform(source) {
  return source.replaceAll("@dtf/registry/", "@/");
}

function read(path) {
  return readFileSync(join(REGISTRY_DIR, path), "utf8");
}

if (!existsSync(OUTPUT_DIR)) {
  // Nothing built yet — leave it to the build, not to a commit gate.
  process.exit(0);
}

const stale = [];
const built = new Map(
  readdirSync(OUTPUT_DIR)
    .filter((file) => file.endsWith(".json"))
    .map((file) => [
      file.replace(/\.json$/, ""),
      JSON.parse(read(join("public/r", file))),
    ]),
);

// 1. Every declared block is built, with every file it declares. Catches a file
//    (or a whole block) added to registry.json without a rebuild.
const declared = JSON.parse(read("registry.json"));
for (const item of declared.items ?? []) {
  const output = built.get(item.name);
  if (!output) {
    stale.push(`${item.name}: declared in registry.json but never built`);
    continue;
  }
  const paths = new Set((output.files ?? []).map((file) => file.path));
  for (const file of item.files ?? []) {
    if (!paths.has(file.path)) {
      stale.push(`${item.name}: missing ${file.path}`);
    }
  }
}

// 2. Every built file still matches its source. Catches the common case — source
//    edited, registry not rebuilt — and files deleted from src after a build.
for (const [name, output] of built) {
  for (const file of output.files ?? []) {
    if (file.content == null) continue;
    if (!existsSync(join(REGISTRY_DIR, file.path))) {
      stale.push(`${name}: ${file.path} no longer exists in src`);
      continue;
    }
    if (transform(read(file.path)) !== file.content) {
      stale.push(`${name}: ${file.path} is out of date`);
    }
  }
}

if (stale.length > 0) {
  console.error("⚠️  Registry output is stale. Run 'pnpm registry:build'.");
  for (const entry of stale.slice(0, 10)) console.error(`   • ${entry}`);
  if (stale.length > 10) console.error(`   … and ${stale.length - 10} more`);
  process.exit(1);
}

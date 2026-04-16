#!/usr/bin/env node

/**
 * Prepares a dist/ copy for `shadcn build`.
 *
 * Source files use @dtf/registry/ imports (Turbopack-compatible).
 * shadcn registry output needs @/ imports (end-user convention).
 * This script copies src/ → dist/src/, rewrites @dtf/registry/ → @/,
 * and creates the configs shadcn build expects.
 */

import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");
const SRC_DIR = join(ROOT_DIR, "src");
const DIST_DIR = join(ROOT_DIR, "dist");

console.log("Starting import transformation...");

// Clean dist
if (existsSync(DIST_DIR)) {
  rmSync(DIST_DIR, { recursive: true, force: true });
}
mkdirSync(DIST_DIR, { recursive: true });

// Copy source
cpSync(SRC_DIR, join(DIST_DIR, "src"), { recursive: true });

// Rewrite @dtf/registry/ → @/ in all TS/TSX files
function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full);
      continue;
    }
    if (!/\.[tj]sx?$/.test(entry)) continue;

    let content = readFileSync(full, "utf8");
    const original = content;
    content = content.replace(/@dtf\/registry\//g, "@/");
    if (content !== original) writeFileSync(full, content);
  }
}

walk(join(DIST_DIR, "src"));
console.log("Transformed @dtf/registry/ -> @/ in dist/src/");

// Create tsconfig for dist with @/ paths
const tsconfig = {
  compilerOptions: {
    lib: ["dom", "dom.iterable", "esnext"],
    allowJs: true,
    skipLibCheck: true,
    strict: true,
    noEmit: true,
    esModuleInterop: true,
    module: "esnext",
    moduleResolution: "bundler",
    resolveJsonModule: true,
    isolatedModules: true,
    jsx: "react-jsx",
    target: "ES2017",
    paths: { "@/*": ["./src/*"] },
  },
  include: ["src/**/*.ts", "src/**/*.tsx"],
  exclude: ["node_modules"],
};
writeFileSync(
  join(DIST_DIR, "tsconfig.json"),
  JSON.stringify(tsconfig, null, 2),
);

// Create components.json with @/ aliases
const componentsJson = JSON.parse(
  readFileSync(join(ROOT_DIR, "components.json"), "utf8"),
);
const distComponents = {
  ...componentsJson,
  aliases: {
    components: "@/components",
    utils: "@/lib/utils",
  },
};
writeFileSync(
  join(DIST_DIR, "components.json"),
  JSON.stringify(distComponents, null, 2),
);

// Copy registry.json
cpSync(join(ROOT_DIR, "registry.json"), join(DIST_DIR, "registry.json"));

console.log("Transformation complete. Ready for shadcn build in dist/");

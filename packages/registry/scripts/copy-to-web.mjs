#!/usr/bin/env node

/**
 * Copies the shadcn build output from dist/public/r/ to
 * packages/registry/public/r/ (the canonical registry output location).
 *
 * apps/web copies from here during its own build so the JSON files become
 * part of web:build's turbo cache — see apps/web/scripts/copy-registry.mjs.
 */
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");
const DIST_R = join(ROOT_DIR, "dist", "public", "r");
const LOCAL_R = join(ROOT_DIR, "public", "r");

if (!existsSync(DIST_R)) {
  console.error("No dist/public/r/ found. Did shadcn build run?");
  process.exit(1);
}

mkdirSync(LOCAL_R, { recursive: true });
cpSync(DIST_R, LOCAL_R, { recursive: true });

console.log("Registry output copied to public/r/");

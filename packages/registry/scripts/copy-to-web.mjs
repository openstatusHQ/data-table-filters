#!/usr/bin/env node

/**
 * Copies the shadcn build output from dist/public/r/ to:
 * - packages/registry/public/r/ (canonical location)
 * - apps/web/public/r/ (served by Next.js)
 */

import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");
const DIST_R = join(ROOT_DIR, "dist", "public", "r");
const LOCAL_R = join(ROOT_DIR, "public", "r");
const WEB_R = join(ROOT_DIR, "..", "..", "apps", "web", "public", "r");

if (!existsSync(DIST_R)) {
  console.error("No dist/public/r/ found. Did shadcn build run?");
  process.exit(1);
}

for (const dest of [LOCAL_R, WEB_R]) {
  mkdirSync(dest, { recursive: true });
  cpSync(DIST_R, dest, { recursive: true });
}

console.log("Registry output copied to public/r/ and apps/web/public/r/");

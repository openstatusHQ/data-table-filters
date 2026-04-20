#!/usr/bin/env node

/**
 * Copies the built registry JSON from packages/registry/public/r/ into
 * apps/web/public/r/ so Next.js can serve them at /r/*.json.
 *
 * Running this as part of web:build (instead of registry:build) means the
 * files land in web:build's turbo cache outputs and get restored on cache
 * hit — otherwise apps/web/public/r/ is empty on Vercel when registry:build
 * hits the remote cache and its script doesn't re-execute.
 */
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_DIR = join(__dirname, "..");
const REGISTRY_R = join(
  WEB_DIR,
  "..",
  "..",
  "packages",
  "registry",
  "public",
  "r",
);
const WEB_R = join(WEB_DIR, "public", "r");

if (!existsSync(REGISTRY_R)) {
  console.error(
    "No packages/registry/public/r/ found. Did registry:build run?",
  );
  process.exit(1);
}

rmSync(WEB_R, { recursive: true, force: true });
mkdirSync(WEB_R, { recursive: true });
cpSync(REGISTRY_R, WEB_R, { recursive: true });

console.log("Registry output copied to apps/web/public/r/");

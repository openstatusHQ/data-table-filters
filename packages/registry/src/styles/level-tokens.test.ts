import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// The level tokens colour both the timeline chart's series (`var(--<key>)`)
// and the level-indicator dots (`bg-<key>`). `--success` once shipped as a
// copy of `--secondary`, a near-background neutral, so success bars and dots
// all but vanished. These pin every copy of the tokens to a real colour.

const repoRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);
const LEVELS = ["success", "warning", "error", "info"] as const;

type Tokens = Record<string, string>;

function read(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), "utf8");
}

/** `--name: value;` pairs of the first block opened by `selector`. */
function cssBlock(css: string, selector: string): Tokens {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`${selector} not found`);
  const body = css.slice(start, css.indexOf("}", start));
  const out: Tokens = {};
  for (const [, name, value] of body.matchAll(/--([\w-]+):\s*([^;]+);/g)) {
    out[name] = value.trim();
  }
  return out;
}

function chroma(value: string): number {
  const match = /^oklch\(\s*[\d.]+\s+([\d.]+)\s+[\d.]+\s*\)$/.exec(value);
  if (!match) throw new Error(`not an oklch colour: ${value}`);
  return Number(match[1]);
}

const manifest = JSON.parse(read("packages/registry/registry.json")) as {
  items: { name: string; cssVars?: { light: Tokens; dark: Tokens } }[];
};
const cssVars = manifest.items.find((item) => item.name === "data-table")
  ?.cssVars as { light: Tokens; dark: Tokens };

const sources = {
  "registry.json": cssVars,
  "registry globals.css": {
    light: cssBlock(read("packages/registry/src/styles/globals.css"), ":root"),
    dark: cssBlock(read("packages/registry/src/styles/globals.css"), ".dark"),
  },
  "web globals.css": {
    light: cssBlock(read("apps/web/src/styles/globals.css"), ":root"),
    dark: cssBlock(read("apps/web/src/styles/globals.css"), ".dark"),
  },
};

describe("level colour tokens", () => {
  for (const [source, themes] of Object.entries(sources)) {
    for (const theme of ["light", "dark"] as const) {
      it.each(LEVELS)(`${source} (${theme}): --%s is a colour`, (level) => {
        const value = themes[theme][level];
        expect(value).toBeDefined();
        expect(chroma(value)).toBeGreaterThan(0.1);
      });
    }
  }

  it("matches between the manifest and both stylesheets", () => {
    for (const theme of ["light", "dark"] as const) {
      for (const level of LEVELS) {
        const values = Object.values(sources).map((s) => s[theme][level]);
        expect(new Set(values).size, `${theme} --${level}`).toBe(1);
      }
    }
  });
});

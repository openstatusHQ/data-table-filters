import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// A shadcn style spells its radius into each component's class string —
// `lyra` writes `rounded-none` everywhere while `--radius` stays 0.625rem — so
// a `rounded-lg` hardcoded in a block stays round on an otherwise square
// install, and one handed to a ui component (`<InputGroup className="rounded-lg">`)
// overrides the style outright. Blocks take their radius from
// `boxRadiusClassName` (lib/style.ts) or leave it to the ui component.

const here = dirname(fileURLToPath(import.meta.url));

/** Deliberate shapes, not box radii. */
const ALLOWED: Record<string, string[]> = {
  // a slider's track and thumb are round by design
  "custom/slider.tsx": ["rounded-full"],
  // 16px / 12px marks: a box radius would turn them into circles
  "data-table/data-table-view-options.tsx": ["rounded-sm"],
  "data-table/data-table-cell/data-table-cell-level-indicator.tsx": [
    "rounded-sm",
  ],
};

function blockFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return name === "ui" ? [] : blockFiles(path);
    }
    return /\.tsx$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });
}

describe("blocks hardcode no radius", () => {
  for (const path of blockFiles(here)) {
    const file = relative(here, path);
    it(file, () => {
      const code = readFileSync(path, "utf8")
        // comments may name utilities
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      const found = [...code.matchAll(/(?<![\w-])rounded-[\w[\]().,%-]+/g)]
        .map(([token]) => token)
        .filter((token) => !(ALLOWED[file] ?? []).includes(token));
      expect(found).toEqual([]);
    });
  }
});

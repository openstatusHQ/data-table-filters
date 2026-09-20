import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// The shadcn nova presets (`base-nova`, `radix-nova` — what `shadcn init`
// installs today) append a check icon with `ml-auto` to every `CommandItem`.
// Our facet counts and suggestion timestamps also sit on `ml-auto`, and two
// auto margins split the row's free space between them: on a fresh install
// the counts landed mid-row instead of flush right. The preset hides its icon
// for any item holding a `data-slot="command-shortcut"` child, so every
// trailing `ml-auto` child inside a `CommandItem` has to carry that slot.
// The command.tsx this repo vendors has no such icon, which is why the docs
// site never showed the gap.

const repoRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../..",
);

const FILES = [
  "packages/registry/src/components/data-table/data-table-filter-command/index.tsx",
  "packages/registry/src/components/data-table/data-table-filter-command-ai/index.tsx",
];

/** Opening `<span …>` tags carrying `ml-auto`, one entry per occurrence. */
function autoMarginSpans(source: string): string[] {
  return [...source.matchAll(/<span\b[^>]*>/g)]
    .map(([tag]) => tag.replace(/\s+/g, " "))
    .filter((tag) => /\bml-auto\b/.test(tag));
}

describe("command item trailing slot", () => {
  for (const file of FILES) {
    const source = readFileSync(join(repoRoot, file), "utf8");
    const spans = autoMarginSpans(source);

    it(`${file} has trailing spans to check`, () => {
      expect(spans.length).toBeGreaterThan(0);
    });

    for (const span of spans) {
      it(`${file}: ${span.slice(0, 60)}… keeps the shortcut slot`, () => {
        expect(span).toContain('data-slot="command-shortcut"');
      });
    }
  }
});

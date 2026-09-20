import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// The command draws one box in two states — a closed trigger and an open
// input — plus a dropdown. Each used to hardcode its own `rounded-lg border
// px-3`, which only agreed by coincidence on the style this repo vendors. On a
// fresh `base-nova` install (what `shadcn init` ships today) the `Command` root
// brings `rounded-xl! p-1`: the open box rounded differently than the trigger,
// its icon sat 4px further in, and the dropdown came out 8px narrower than the
// box. `rounded-xl!` is `!important`, so no utility passed through `cn` can win
// it back — the only fix is to keep every visible edge off the root and take
// the chrome from the style's own `buttonVariants`.

const repoRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../..",
);

const FILES = [
  "packages/registry/src/components/data-table/data-table-filter-command/index.tsx",
  "packages/registry/src/components/data-table/data-table-filter-command-ai/index.tsx",
];

/** The `className={…}` of the first JSX tag opening with `opening`. */
function classNameOf(source: string, opening: string): string {
  const start = source.indexOf(opening);
  if (start === -1) throw new Error(`no ${opening} in source`);
  const attr = source.indexOf("className={", start);
  if (attr === -1) throw new Error(`no className on ${opening}`);
  // walk to the brace closing the attribute, so the slice never reaches the
  // tag's other props or the markup after it
  let depth = 0;
  for (let i = attr + "className=".length; i < source.length; i++) {
    if (source[i] === "{") depth++;
    if (source[i] === "}" && --depth === 0) return source.slice(attr, i + 1);
  }
  throw new Error(`unclosed className on ${opening}`);
}

describe("command box chrome", () => {
  for (const file of FILES) {
    const source = readFileSync(join(repoRoot, file), "utf8");
    // Everything from the return on: the class constants above it are allowed
    // to name utilities, the markup is not.
    const markup = source.slice(source.indexOf("  return (\n    <div>"));

    it(`${file} takes its chrome from the style's buttonVariants`, () => {
      expect(source).toContain(
        'import { buttonVariants } from "@dtf/registry/components/ui/button";',
      );
      expect(source).toContain('buttonVariants({ variant: "outline" })');
    });

    it(`${file} draws the closed trigger and the open box from one constant`, () => {
      expect(classNameOf(markup, "<button\n        type=")).toContain(
        "boxClassName",
      );
      // the wrapper right before the cmdk input
      const input = markup.indexOf("<CommandPrimitive.Input");
      const wrapper = markup.lastIndexOf("<div", input);
      expect(markup.slice(wrapper, input)).toContain("boxClassName");
    });

    it(`${file} keeps the dropdown's radius in step with the box`, () => {
      const list = markup.indexOf("<CommandList");
      const panel = markup.lastIndexOf("<div", list);
      const panelTag = markup.slice(panel, list);
      expect(panelTag).toContain("boxRadiusClassName");
      expect(panelTag).not.toMatch(/\brounded-/);
    });

    it(`${file} leaves no surface on the Command root`, () => {
      const root = classNameOf(markup, "<Command\n");
      for (const utility of ["bg-transparent", "p-0", "border-none"]) {
        expect(root).toContain(utility);
      }
      // a radius here would lose to a style's `rounded-xl!` anyway
      expect(root).not.toMatch(/"[^"]*\brounded-/);
    });

    it(`${file} hardcodes no box radius in its markup`, () => {
      const boxRadius = [...markup.matchAll(/\brounded-(lg|xl|2xl)\b/g)];
      expect(boxRadius).toEqual([]);
    });
  }
});

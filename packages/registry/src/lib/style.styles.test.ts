import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import styles from "./__fixtures__/shadcn-styles.json";
import {
  getBackgroundClassName,
  getBorderClassName,
  getRadiusClassName,
} from "./style";
import { cn } from "./utils";

// The class strings every `shadcn init -p <base|radix>-<style>` writes into
// `components/ui/button.tsx` (outline variant, default size) and onto the
// `Command` root, vendored from ui.shadcn.com/r/styles. `base-*` and `radix-*`
// carry the same strings, so one entry covers both. Refresh the fixture when
// shadcn ships a new style.

const here = dirname(fileURLToPath(import.meta.url));

// Both commands carry their own copy of the box and root literals.
const COMMANDS = ["data-table-filter-command", "data-table-filter-command-ai"];

/** The literals a command block passes to its box and to the `Command` root. */
function literalsOf(command: string) {
  const source = readFileSync(
    join(here, `../components/data-table/${command}/index.tsx`),
    "utf8",
  );
  const literal = (pattern: RegExp): string => {
    const match = source.match(pattern);
    if (!match) throw new Error(`${pattern} not found in ${command}`);
    return match[1];
  };
  return {
    boxLayout: literal(/"(h-11 [^"]+)"/),
    rootReset: literal(/"(overflow-visible [^"]+)"/),
  };
}

const tokens = (className: string) => className.split(/\s+/);

describe.each(Object.entries(styles))("shadcn style %s", (_, style) => {
  it("names a radius we can read", () => {
    expect(getRadiusClassName(style.outlineButton, "")).toMatch(
      /^rounded-[\w[\]().,-]+$/,
    );
  });

  it("names a resting border and background", () => {
    expect(tokens(getBorderClassName(style.outlineButton))).toContain("border");
    expect(getBackgroundClassName(style.outlineButton)).not.toBe("");
  });

  describe.each(COMMANDS)("%s", (command) => {
    const { boxLayout, rootReset } = literalsOf(command);

    it("lets the command box set its own height, padding and alignment", () => {
      const box = tokens(cn(style.outlineButton, boxLayout));
      const only = (pattern: RegExp) => box.filter((t) => pattern.test(t));
      expect(only(/^h-/)).toEqual(["h-11"]);
      expect(only(/^px-/)).toEqual(["px-3"]);
      expect(only(/^gap-/)).toEqual(["gap-2"]);
      expect(only(/^justify-/)).toEqual(["justify-start"]);
      expect(only(/^font-(normal|medium|semibold|bold)$/)).toEqual([
        "font-normal",
      ]);
    });

    it("leaves no surface on the Command root", () => {
      const root = tokens(cn(style.commandRoot, rootReset));
      expect(root).not.toContain("bg-popover");
      expect(root).not.toContain("overflow-hidden");
      expect(root.filter((t) => /^p[xytrbl]?-/.test(t))).toEqual(["p-0"]);
      expect(root).toContain("overflow-visible");
      expect(root).toContain("bg-transparent");
    });
  });
});

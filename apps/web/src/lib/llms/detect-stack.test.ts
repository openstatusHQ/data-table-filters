import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { RADIX_INIT_COMMAND } from "./blocks";

// The skill's first step is `scripts/detect-stack.sh`. The blocks install on
// either component library, so the script reports which one the project is on
// rather than gating the install — an agent still needs to know what its `ui/`
// holds. These tests run the real script against minimal projects.

const script = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../../skills/data-table-filters/scripts/detect-stack.sh",
);

const projects: string[] = [];

function project(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "dtf-detect-"));
  projects.push(dir);
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, name), content);
  }
  return dir;
}

function detect(dir: string) {
  const result = spawnSync("bash", [script], { cwd: dir, encoding: "utf8" });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

function componentsJson(style: string): string {
  return JSON.stringify({ style, tailwind: { css: "src/app/globals.css" } });
}

afterEach(() => {
  for (const dir of projects.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("detect-stack.sh component library", () => {
  it("reports a Base UI project without blocking it", () => {
    const { status, output } = detect(
      project({ "components.json": componentsJson("base-nova") }),
    );

    expect(status).toBe(0);
    expect(output).toContain("Component library: base-ui (base-nova)");
    expect(output).not.toContain("BLOCKING");
  });

  it("passes a shadcn v4 radix project without a warning", () => {
    const { output } = detect(
      project({ "components.json": componentsJson("radix-nova") }),
    );

    expect(output).toContain("Component library: radix (radix-nova)");
    expect(output).not.toContain("BLOCKING");
  });

  it.each(["new-york", "default"])(
    "treats the pre-v4 %s style as radix",
    (style) => {
      const { output } = detect(
        project({ "components.json": componentsJson(style) }),
      );

      expect(output).toContain(`Component library: radix (${style})`);
      expect(output).not.toContain("BLOCKING");
    },
  );

  it("reports an unknown style without blocking", () => {
    const { output } = detect(
      project({ "components.json": componentsJson("aria-nova") }),
    );

    expect(output).toContain("Component library: unknown (aria-nova)");
    expect(output).not.toContain("BLOCKING");
  });

  it("says so when shadcn is not initialized", () => {
    const { status, output } = detect(project({ "package.json": "{}" }));

    expect(status).toBe(0);
    expect(output).toContain("shadcn/ui: not initialized");
    expect(output).toContain("Component library: unknown");
    expect(output).toContain("Initialize shadcn first");
    expect(output).toContain("npx shadcn@latest init -d");
    expect(output).toContain(RADIX_INIT_COMMAND);
    expect(output).not.toContain("BLOCKING");
  });
});

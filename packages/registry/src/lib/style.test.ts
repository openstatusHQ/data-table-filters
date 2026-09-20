import { describe, expect, it } from "vitest";
import {
  boxRadiusClassName,
  boxSurfaceClassName,
  getBackgroundClassName,
  getBorderClassName,
  getRadiusClassName,
} from "./style";

describe("getRadiusClassName", () => {
  it("reads the radius a style writes into its class string", () => {
    expect(getRadiusClassName("inline-flex rounded-lg border text-sm")).toBe(
      "rounded-lg",
    );
    expect(getRadiusClassName("inline-flex rounded-none border")).toBe(
      "rounded-none",
    );
  });

  it("reads the bare utility", () => {
    expect(getRadiusClassName("inline-flex rounded border")).toBe("rounded");
    expect(getRadiusClassName("roundedish hover:rounded border")).toBe(
      "rounded-md",
    );
  });

  it("keeps arbitrary values", () => {
    expect(getRadiusClassName("h-6 rounded-[min(var(--radius-md),10px)]")).toBe(
      "rounded-[min(var(--radius-md),10px)]",
    );
  });

  it("skips conditional radii", () => {
    expect(
      getRadiusClassName(
        "rounded-none in-data-[slot=button-group]:rounded-lg hover:rounded-xl",
      ),
    ).toBe("rounded-none");
  });

  it("falls back when the style names no radius", () => {
    expect(getRadiusClassName("inline-flex border")).toBe("rounded-md");
    expect(getRadiusClassName("", "rounded-lg")).toBe("rounded-lg");
  });
});

describe("boxRadiusClassName", () => {
  it("follows the vendored button", () => {
    expect(boxRadiusClassName).toBe("rounded-md");
  });
});

describe("getBackgroundClassName", () => {
  it("keeps the resting background, light and dark", () => {
    expect(
      getBackgroundClassName(
        "border bg-background shadow-xs dark:border-input dark:bg-input/30",
      ),
    ).toBe("bg-background dark:bg-input/30");
  });

  it("skips interactive backgrounds and bg-clip", () => {
    expect(
      getBackgroundClassName(
        "bg-clip-padding bg-background hover:bg-muted aria-expanded:bg-muted dark:hover:bg-input/50",
      ),
    ).toBe("bg-background");
  });

  it("is empty when the style names none", () => {
    expect(getBackgroundClassName("inline-flex border")).toBe("");
  });
});

describe("boxSurfaceClassName", () => {
  it("follows the vendored outline button", () => {
    expect(boxSurfaceClassName).toBe(
      "rounded-md dark:border-input border bg-background dark:bg-input/30",
    );
  });
});

describe("getBorderClassName", () => {
  it("keeps the resting border, light and dark, in order", () => {
    expect(
      getBorderClassName(
        "border border-transparent bg-clip-padding border-border dark:border-input",
      ),
    ).toBe("border border-transparent border-border dark:border-input");
  });

  it("skips interactive borders", () => {
    expect(
      getBorderClassName(
        "border focus-visible:border-ring aria-invalid:border-destructive",
      ),
    ).toBe("border");
  });
});

import { describe, expect, it } from "vitest";
import { boxRadiusClassName, getRadiusClassName } from "./style";

describe("getRadiusClassName", () => {
  it("reads the radius a style writes into its class string", () => {
    expect(getRadiusClassName("inline-flex rounded-lg border text-sm")).toBe(
      "rounded-lg",
    );
    expect(getRadiusClassName("inline-flex rounded-none border")).toBe(
      "rounded-none",
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

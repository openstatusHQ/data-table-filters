import { describe, expect, it } from "vitest";
import { getLevelColor, getLevelRowClassName, getLevelLabel } from "./level";

describe("getLevelColor", () => {
  it("returns muted for success", () => {
    expect(getLevelColor("success").text).toBe("text-muted");
  });

  it("returns warning for warning", () => {
    expect(getLevelColor("warning").text).toBe("text-warning");
  });

  it("returns error for error", () => {
    expect(getLevelColor("error").text).toBe("text-error");
  });

  it("returns info for info", () => {
    expect(getLevelColor("info").text).toBe("text-info");
  });

  it("returns info as default", () => {
    expect(getLevelColor("unknown" as any).text).toBe("text-info");
  });

  it("returns object with text, bg, and border", () => {
    const color = getLevelColor("error");
    expect(color).toHaveProperty("text");
    expect(color).toHaveProperty("bg");
    expect(color).toHaveProperty("border");
  });
});

describe("getLevelRowClassName", () => {
  it("returns empty string for success", () => {
    expect(getLevelRowClassName("success")).toBe("");
  });

  it("returns non-empty class for warning", () => {
    expect(getLevelRowClassName("warning")).toContain("bg-warning");
  });

  it("returns non-empty class for error", () => {
    expect(getLevelRowClassName("error")).toContain("bg-error");
  });

  it("returns non-empty class for info", () => {
    expect(getLevelRowClassName("info")).toContain("bg-info");
  });

  it("returns empty string for unknown level", () => {
    expect(getLevelRowClassName("unknown" as any)).toBe("");
  });
});

describe("getLevelLabel", () => {
  it("returns '2xx' for success", () => {
    expect(getLevelLabel("success")).toBe("2xx");
  });

  it("returns '4xx' for warning", () => {
    expect(getLevelLabel("warning")).toBe("4xx");
  });

  it("returns '5xx' for error", () => {
    expect(getLevelLabel("error")).toBe("5xx");
  });

  it("returns 'Unknown' for info", () => {
    expect(getLevelLabel("info")).toBe("Unknown");
  });
});

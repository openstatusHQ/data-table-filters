import { describe, expect, it } from "vitest";
import { getStatusColor } from "./status-code";

describe("getStatusColor", () => {
  it("returns blue for 1xx informational", () => {
    expect(getStatusColor(100).text).toContain("blue");
    expect(getStatusColor(101).text).toContain("blue");
  });

  it("returns green for 2xx success", () => {
    expect(getStatusColor(200).text).toContain("green");
    expect(getStatusColor(204).text).toContain("green");
  });

  it("returns yellow for 3xx redirect", () => {
    expect(getStatusColor(301).text).toContain("yellow");
    expect(getStatusColor(304).text).toContain("yellow");
  });

  it("returns orange for 4xx client error", () => {
    expect(getStatusColor(400).text).toContain("orange");
    expect(getStatusColor(404).text).toContain("orange");
    expect(getStatusColor(429).text).toContain("orange");
  });

  it("returns red for 5xx server error", () => {
    expect(getStatusColor(500).text).toContain("red");
    expect(getStatusColor(503).text).toContain("red");
  });

  it("returns gray for < 100", () => {
    expect(getStatusColor(0).text).toContain("gray");
    expect(getStatusColor(99).text).toContain("gray");
  });

  it("returns gray for >= 600", () => {
    expect(getStatusColor(600).text).toContain("gray");
    expect(getStatusColor(999).text).toContain("gray");
  });

  it("returns object with text, bg, and border keys", () => {
    const color = getStatusColor(200);
    expect(color).toHaveProperty("text");
    expect(color).toHaveProperty("bg");
    expect(color).toHaveProperty("border");
  });
});

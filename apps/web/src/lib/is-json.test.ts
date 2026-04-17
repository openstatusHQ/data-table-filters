import { describe, expect, it } from "vitest";
import { isJSON } from "./is-json";

describe("isJSON", () => {
  it("returns true for valid JSON object", () => {
    expect(isJSON('{"key": "value"}')).toBe(true);
  });

  it("returns true for valid JSON array", () => {
    expect(isJSON("[1, 2, 3]")).toBe(true);
  });

  it("returns true for JSON string", () => {
    expect(isJSON('"hello"')).toBe(true);
  });

  it("returns true for JSON number", () => {
    expect(isJSON("42")).toBe(true);
  });

  it("returns true for JSON boolean", () => {
    expect(isJSON("true")).toBe(true);
    expect(isJSON("false")).toBe(true);
  });

  it("returns true for JSON null", () => {
    expect(isJSON("null")).toBe(true);
  });

  it("returns false for invalid JSON", () => {
    expect(isJSON("{invalid}")).toBe(false);
    expect(isJSON("undefined")).toBe(false);
    expect(isJSON("")).toBe(false);
    expect(isJSON("{")).toBe(false);
  });
});

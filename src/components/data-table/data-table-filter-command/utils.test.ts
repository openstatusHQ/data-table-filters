import { describe, expect, it } from "vitest";
import type { DataTableFilterField } from "../types";
import {
  getFieldValueByType,
  getFilterValue,
  getWordByCaretPosition,
  notEmpty,
  serializeFilterValue,
  tokenizeFilterInput,
} from "./utils";

// ── getWordByCaretPosition ───────────────────────────────────────────────────

describe("getWordByCaretPosition", () => {
  it("extracts word at start of string", () => {
    expect(
      getWordByCaretPosition({ value: "hello world", caretPosition: 3 }),
    ).toBe("hello");
  });

  it("extracts word at end of string", () => {
    expect(
      getWordByCaretPosition({ value: "hello world", caretPosition: 8 }),
    ).toBe("world");
  });

  it("extracts middle word", () => {
    expect(
      getWordByCaretPosition({ value: "a bb ccc", caretPosition: 3 }),
    ).toBe("bb");
  });

  it("handles caret at start", () => {
    expect(getWordByCaretPosition({ value: "word", caretPosition: 0 })).toBe(
      "word",
    );
  });

  it("handles caret at end", () => {
    expect(getWordByCaretPosition({ value: "word", caretPosition: 4 })).toBe(
      "word",
    );
  });

  it("handles single word", () => {
    expect(
      getWordByCaretPosition({ value: "level:error", caretPosition: 5 }),
    ).toBe("level:error");
  });
});

// ── tokenizeFilterInput ──────────────────────────────────────────────────────

describe("tokenizeFilterInput", () => {
  it("tokenizes simple key:value pairs", () => {
    expect(tokenizeFilterInput("name:john regions:ams")).toEqual([
      ["name", "john"],
      ["regions", "ams"],
    ]);
  });

  it("handles double-quoted values with spaces", () => {
    expect(tokenizeFilterInput('name:"john doe" regions:ams')).toEqual([
      ["name", "john doe"],
      ["regions", "ams"],
    ]);
  });

  it("handles single-quoted values with spaces", () => {
    expect(tokenizeFilterInput("name:'john doe'")).toEqual([
      ["name", "john doe"],
    ]);
  });

  it("returns empty array for empty input", () => {
    expect(tokenizeFilterInput("")).toEqual([]);
    expect(tokenizeFilterInput("   ")).toEqual([]);
  });

  it("ignores text without key:value format", () => {
    expect(tokenizeFilterInput("just some text")).toEqual([]);
  });

  it("handles comma-delimited values", () => {
    expect(tokenizeFilterInput("level:error,warn,info")).toEqual([
      ["level", "error,warn,info"],
    ]);
  });

  it("handles URLs in quoted values", () => {
    expect(tokenizeFilterInput('url:"https://example.com/path"')).toEqual([
      ["url", "https://example.com/path"],
    ]);
  });
});

// ── serializeFilterValue ─────────────────────────────────────────────────────

describe("serializeFilterValue", () => {
  it("returns value as-is when no spaces", () => {
    expect(serializeFilterValue("error")).toBe("error");
  });

  it("wraps value in quotes when it contains spaces", () => {
    expect(serializeFilterValue("john doe")).toBe('"john doe"');
  });

  it("handles empty string", () => {
    expect(serializeFilterValue("")).toBe("");
  });
});

// ── getFieldValueByType ──────────────────────────────────────────────────────

describe("getFieldValueByType", () => {
  it("returns null when field is undefined", () => {
    expect(getFieldValueByType({ field: undefined, value: "test" })).toBeNull();
  });

  it("joins slider array values with dash delimiter", () => {
    const field = {
      type: "slider",
      label: "Latency",
      value: "latency",
      min: 0,
      max: 100,
    } as DataTableFilterField<any>;
    expect(getFieldValueByType({ field, value: [0, 100] })).toBe("0-100");
  });

  it("joins checkbox array values with comma delimiter", () => {
    const field = {
      type: "checkbox",
      label: "Level",
      value: "level",
    } as DataTableFilterField<any>;
    expect(getFieldValueByType({ field, value: ["error", "warn"] })).toBe(
      "error,warn",
    );
  });

  it("splits checkbox string value into array", () => {
    const field = {
      type: "checkbox",
      label: "Level",
      value: "level",
    } as DataTableFilterField<any>;
    expect(getFieldValueByType({ field, value: "error,warn" })).toEqual([
      "error",
      "warn",
    ]);
  });

  it("joins timerange date array with dash delimiter", () => {
    const d1 = new Date("2024-01-01");
    const d2 = new Date("2024-01-31");
    const field = {
      type: "timerange",
      label: "Date",
      value: "date",
    } as DataTableFilterField<any>;
    const result = getFieldValueByType({ field, value: [d1, d2] });
    expect(result).toBe(`${d1.getTime()}-${d2.getTime()}`);
  });

  it("returns single date as getTime()", () => {
    const d = new Date("2024-01-15");
    const field = {
      type: "timerange",
      label: "Date",
      value: "date",
    } as DataTableFilterField<any>;
    expect(getFieldValueByType({ field, value: d })).toBe(d.getTime());
  });

  it("returns input value as-is", () => {
    const field = {
      type: "input",
      label: "Path",
      value: "path",
    } as DataTableFilterField<any>;
    expect(getFieldValueByType({ field, value: "test" })).toBe("test");
  });
});

// ── getFilterValue ───────────────────────────────────────────────────────────

describe("getFilterValue", () => {
  it("returns 1 when value includes currentWord (case-insensitive)", () => {
    expect(
      getFilterValue({
        value: "level:error",
        search: "",
        currentWord: "level",
      }),
    ).toBe(1);
  });

  it("returns 0 when value does not match", () => {
    expect(
      getFilterValue({
        value: "level:error",
        search: "",
        currentWord: "status",
      }),
    ).toBe(0);
  });

  it("handles suggestion: prefix", () => {
    expect(
      getFilterValue({
        value: "suggestion:level:error",
        search: "error",
        currentWord: "",
      }),
    ).toBe(1);
    expect(
      getFilterValue({
        value: "suggestion:level:error",
        search: "warn",
        currentWord: "",
      }),
    ).toBe(0);
  });

  it("handles checkbox comma-delimited query", () => {
    // "ams" is the last element being typed, so it should match
    expect(
      getFilterValue({
        value: "regions:ams",
        search: "",
        currentWord: "regions:gru,ams",
      }),
    ).toBe(1);
  });

  it("returns 0 for already-selected checkbox value", () => {
    // "ams" already fully matches an earlier position (index 0) and is not the last element
    expect(
      getFilterValue({
        value: "regions:ams",
        search: "",
        currentWord: "regions:ams,gru",
      }),
    ).toBe(0);
  });
});

// ── notEmpty ─────────────────────────────────────────────────────────────────

describe("notEmpty", () => {
  it("returns true for non-null values", () => {
    expect(notEmpty("hello")).toBe(true);
    expect(notEmpty(0)).toBe(true);
    expect(notEmpty(false)).toBe(true);
    expect(notEmpty("")).toBe(true);
  });

  it("returns false for null", () => {
    expect(notEmpty(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(notEmpty(undefined)).toBe(false);
  });
});

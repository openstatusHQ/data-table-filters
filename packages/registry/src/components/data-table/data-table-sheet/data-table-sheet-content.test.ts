import { describe, expect, it } from "vitest";
import { sheetValueText } from "./data-table-sheet-content";

describe("sheetValueText", () => {
  it("has nothing to show for a missing value", () => {
    // Regression: a column the endpoint sent as `null` printed "null".
    expect(sheetValueText(null)).toBeNull();
    expect(sheetValueText(undefined)).toBeNull();
  });

  it("writes a record as JSON", () => {
    // Regression: a record column whose sheet component did not travel with
    // the schema printed "[object Object]".
    expect(sheetValueText({ Server: "Cloudflare" })).toBe(
      '{\n  "Server": "Cloudflare"\n}',
    );
    expect(sheetValueText(["a", "b"])).toBe('[\n  "a",\n  "b"\n]');
  });

  it("keeps scalars as they are", () => {
    expect(sheetValueText("GET")).toBe("GET");
    expect(sheetValueText(0)).toBe("0");
    expect(sheetValueText(false)).toBe("false");
    expect(sheetValueText("")).toBe("");
  });

  it("writes a date as ISO and drops an invalid one", () => {
    expect(sheetValueText(new Date("2026-01-02T03:04:05.000Z"))).toBe(
      "2026-01-02T03:04:05.000Z",
    );
    expect(sheetValueText(new Date("nope"))).toBeNull();
  });

  it("does not throw on a value JSON cannot write", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(sheetValueText(circular)).toBe("[object Object]");
  });
});

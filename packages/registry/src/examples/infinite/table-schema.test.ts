import { describe, expect, it } from "vitest";
import { getLevelRowClassName, LEVELS } from "./table-schema";

describe("getLevelRowClassName", () => {
  // Same tokens as the level dot and the chart series, so a row's tint
  // matches its indicator.
  it.each([
    ["warning", "bg-warning/5"],
    ["error", "bg-error/5"],
  ])("tints a %s row with its level colour", (level, className) => {
    expect(getLevelRowClassName(level).split(" ")).toContain(className);
  });

  it.each(["warning", "error"])(
    "deepens a %s row that is open in the sheet or checked",
    (level) => {
      const tokens = getLevelRowClassName(level).split(" ");
      // single-select (this example, no select column)
      expect(tokens).toContain(`data-[state=selected]:bg-${level}/20`);
      expect(tokens).toContain(`dark:data-[state=selected]:bg-${level}/30`);
      // multi-select, should a select column be added
      expect(tokens).toContain(`data-detail:bg-${level}/20`);
      expect(tokens).toContain(`data-checked:bg-${level}/20`);
    },
  );

  it("leaves info, the bulk of the rows, plain", () => {
    expect(LEVELS).toContain("info");
    expect(getLevelRowClassName("info")).toBe("");
  });
});

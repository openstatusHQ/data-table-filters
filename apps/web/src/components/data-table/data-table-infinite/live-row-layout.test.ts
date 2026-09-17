import { describe, expect, it } from "vitest";
import { getLiveRowLayout } from "./live-row-layout";

describe("getLiveRowLayout", () => {
  it("puts the indicator first when its column leads", () => {
    expect(getLiveRowLayout(["level", "date", "status"], "level")).toEqual({
      leading: [],
      indicator: "level",
      span: 2,
    });
  });

  // Regression: with a select column in front, the indicator was rendered in
  // the first cell and sat under the checkbox instead of the level column.
  it("leaves an empty cell for each column before the indicator", () => {
    expect(
      getLiveRowLayout(["select", "level", "date", "status"], "level"),
    ).toEqual({ leading: ["select"], indicator: "level", span: 2 });
  });

  it("follows the column order, not the definition order", () => {
    expect(getLiveRowLayout(["date", "select", "level"], "level")).toEqual({
      leading: ["date", "select"],
      indicator: "level",
      span: 0,
    });
  });

  it("spans the whole row when the indicator column is hidden", () => {
    expect(getLiveRowLayout(["select", "date", "status"], "level")).toEqual({
      leading: [],
      indicator: undefined,
      span: 3,
    });
  });

  it("handles no visible columns", () => {
    expect(getLiveRowLayout([], "level")).toEqual({
      leading: [],
      indicator: undefined,
      span: 0,
    });
  });
});

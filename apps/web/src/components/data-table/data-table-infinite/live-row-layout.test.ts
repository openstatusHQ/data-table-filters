import { describe, expect, it } from "vitest";
import { getLiveRowLayout } from "./live-row-layout";

describe("getLiveRowLayout", () => {
  it("puts the indicator first when its column leads", () => {
    expect(getLiveRowLayout(["level", "date", "status"], "level")).toEqual({
      leading: [],
      indicator: "level",
      span: 2,
      label: "after",
    });
  });

  // Regression: with a select column in front, the indicator was rendered in
  // the first cell and sat under the checkbox instead of the level column.
  it("leaves an empty cell for each column before the indicator", () => {
    expect(
      getLiveRowLayout(["select", "level", "date", "status"], "level"),
    ).toEqual({
      leading: ["select"],
      indicator: "level",
      span: 2,
      label: "after",
    });
  });

  // Regression: with the indicator column last, the label had zero columns
  // to span and was dropped, leaving a marker row with no "Live Mode" text.
  it("moves the label in front when the indicator column is last", () => {
    expect(getLiveRowLayout(["date", "select", "level"], "level")).toEqual({
      leading: ["date", "select"],
      indicator: "level",
      span: 2,
      label: "before",
    });
  });

  it("shares the indicator cell when it is the only column", () => {
    expect(getLiveRowLayout(["level"], "level")).toEqual({
      leading: [],
      indicator: "level",
      span: 0,
      label: "indicator",
    });
  });

  it("spans the whole row when the indicator column is hidden", () => {
    expect(getLiveRowLayout(["select", "date", "status"], "level")).toEqual({
      leading: [],
      indicator: undefined,
      span: 3,
      label: "after",
    });
  });

  it("handles no visible columns", () => {
    expect(getLiveRowLayout([], "level")).toEqual({
      leading: [],
      indicator: undefined,
      span: 0,
      label: "after",
    });
  });
});

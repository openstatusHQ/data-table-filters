import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DataTableCellLevelIndicator } from "./data-table-cell-level-indicator";

function render(value: string) {
  return renderToStaticMarkup(<DataTableCellLevelIndicator value={value} />);
}

describe("DataTableCellLevelIndicator", () => {
  // Same tokens the timeline chart colours its series with, so a level's dot
  // and its bar match.
  it.each([
    ["success", "bg-success"],
    ["error", "bg-error"],
    ["warn", "bg-warning"],
    ["warning", "bg-warning"],
    ["info", "bg-info"],
    ["debug", "bg-muted-foreground"],
  ])("colours %s with %s", (value, color) => {
    expect(render(value)).toContain(color);
  });

  it("matches the level case-insensitively", () => {
    expect(render("SUCCESS")).toContain("bg-success");
  });

  it("falls back to a neutral dot for an unknown level", () => {
    expect(render("trace")).toContain("bg-muted");
  });

  it("uses an explicit colour instead of the built-in class", () => {
    const html = renderToStaticMarkup(
      <DataTableCellLevelIndicator value="success" color="#ff00ff" />,
    );
    expect(html).not.toContain("bg-success");
    expect(html).toContain("background-color:#ff00ff");
  });
});

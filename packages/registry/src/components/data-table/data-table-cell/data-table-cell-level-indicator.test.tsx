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

  it("puts the dot before the label by default", () => {
    const html = renderToStaticMarkup(
      <DataTableCellLevelIndicator value="info" showLabel />,
    );
    expect(html.indexOf("bg-info")).toBeLessThan(html.indexOf(">info<"));
  });

  it('puts the dot after the label with dotPosition="end"', () => {
    const html = renderToStaticMarkup(
      <DataTableCellLevelIndicator value="info" showLabel dotPosition="end" />,
    );
    expect(html.indexOf("bg-info")).toBeGreaterThan(html.indexOf(">info<"));
  });

  it("sizes the label to its widest sibling so end dots line up", () => {
    const html = renderToStaticMarkup(
      <DataTableCellLevelIndicator
        value="info"
        showLabel
        dotPosition="end"
        alignLabels={["warning", "info", "日本語のラベル"]}
      />,
    );
    // one invisible sizer per sibling, stacked in the label's grid cell —
    // measured by the browser, so wide glyphs need no special casing
    expect(html).toContain("inline-grid");
    expect(html).toContain('data-label="warning"');
    expect(html).toContain('data-label="日本語のラベル"');
    // no fixed or minimum width to outgrow or be clipped by
    expect(html).not.toContain("width");
  });

  it("keeps the sizers out of the text and the accessibility tree", () => {
    const html = renderToStaticMarkup(
      <DataTableCellLevelIndicator
        value="info"
        showLabel
        alignLabels={["warning", "info"]}
      />,
    );
    expect(html).not.toContain(">warning<");
    expect(html.match(/aria-hidden="true"/g)).toHaveLength(2);
    expect(html.match(/>info</g)).toHaveLength(1);
  });
});

import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { getSection } from "./get-content";
import { headingText } from "./heading-text";
import { splitIntoSections } from "./search";
import { slugify } from "./slugify";

describe("headingText", () => {
  it("returns plain string children as-is", () => {
    expect(headingText("Cursor Pagination")).toBe("Cursor Pagination");
  });

  it("reads through elements instead of stringifying them", () => {
    const children = [
      "The ",
      createElement("code", { key: "c" }, "query_table"),
      " Tool",
    ];

    expect(headingText(children)).toBe("The query_table Tool");
  });

  it("recurses into nested elements", () => {
    const children = createElement(
      "strong",
      null,
      createElement("em", null, "Deeply nested"),
    );

    expect(headingText(children)).toBe("Deeply nested");
  });

  it("ignores empty nodes", () => {
    expect(headingText([null, undefined, false, "Kept"])).toBe("Kept");
  });
});

describe("rendered heading ids", () => {
  /**
   * The docs page derives ids from the rendered children, while the table of
   * contents and the docs search derive anchors from the markdown source. They
   * have to agree, or every deep link lands at the top of the page.
   */
  it.each([
    [
      "mcp",
      "The `query_table` Tool",
      ["The ", ["code", "query_table"], " Tool"],
    ],
    [
      "table-schema",
      "Row Selection with `col.select()`",
      ["Row Selection with ", ["code", "col.select()"]],
    ],
    [
      "ai-filters",
      "`commandDisabled` fields are still available to AI",
      [["code", "commandDisabled"], " fields are still available to AI"],
    ],
  ])("matches the source-derived anchor on %s", (_slug, source, rendered) => {
    const children = rendered.map((part, index) =>
      typeof part === "string"
        ? part
        : createElement(part[0], { key: index }, part[1]),
    );

    expect(slugify(headingText(children))).toBe(slugify(source));
  });

  it("covers every heading in the real docs", async () => {
    // Any heading whose markdown carries syntax is a candidate for the
    // `[object Object]` bug, so assert the whole set round-trips.
    const doc = await getSection("docs", "mcp");
    const headings = splitIntoSections(doc!.meta, doc!.source)
      .map((section) => section.heading)
      .filter((heading): heading is string => Boolean(heading));

    expect(headings.some((heading) => heading.includes("`"))).toBe(true);
    for (const heading of headings) {
      const rendered = heading.replaceAll("`", "");
      expect(slugify(headingText(rendered))).toBe(slugify(heading));
    }
  });
});

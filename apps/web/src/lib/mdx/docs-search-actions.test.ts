import { describe, expect, it } from "vitest";
import { filterPaletteGroups, PALETTE_GROUPS } from "./docs-search-actions";

const labels = (groups: ReturnType<typeof filterPaletteGroups>) =>
  groups.map((group) => [
    group.heading,
    group.actions.map((action) => action.label),
  ]);

describe("PALETTE_GROUPS", () => {
  it("covers every app route besides the docs", () => {
    const hrefs = PALETTE_GROUPS.flatMap((group) =>
      group.actions.flatMap((action) =>
        action.href && !action.external ? [action.href] : [],
      ),
    );
    expect(hrefs.sort()).toEqual(
      [
        "/",
        "/auto",
        "/builder",
        "/default",
        "/drizzle",
        "/infinite",
        "/light",
      ].sort(),
    );
  });

  it("offers all three themes", () => {
    const themes = PALETTE_GROUPS.flatMap((group) =>
      group.actions.flatMap((action) => (action.theme ? [action.theme] : [])),
    );
    expect(themes).toEqual(["light", "dark", "system"]);
  });

  it("opens links in a new tab and pages in place", () => {
    for (const group of PALETTE_GROUPS) {
      for (const action of group.actions) {
        if (!action.href) continue;
        expect(action.external ?? false, action.label).toBe(
          action.href.startsWith("http"),
        );
      }
    }
  });
});

describe("filterPaletteGroups", () => {
  it("returns every group in full for an empty query", () => {
    expect(filterPaletteGroups(PALETTE_GROUPS, "")).toBe(PALETTE_GROUPS);
    expect(filterPaletteGroups(PALETTE_GROUPS, "   ")).toBe(PALETTE_GROUPS);
  });

  it("matches on keywords, not only the label", () => {
    expect(labels(filterPaletteGroups(PALETTE_GROUPS, "twitter"))).toEqual([
      ["Links", ["X"]],
    ]);
  });

  it("requires every word of the query", () => {
    expect(labels(filterPaletteGroups(PALETTE_GROUPS, "dark theme"))).toEqual([
      ["Appearance", ["Dark"]],
    ]);
    expect(filterPaletteGroups(PALETTE_GROUPS, "dark twitter")).toEqual([]);
  });

  it("drops groups with no match and keeps the group order", () => {
    const result = filterPaletteGroups(PALETTE_GROUPS, "github");
    expect(result.map((group) => group.heading)).toEqual(["Links"]);
    expect(result[0].actions.map((action) => action.label)).toEqual([
      "GitHub",
      "Report an issue",
    ]);
  });

  it("ignores case", () => {
    expect(labels(filterPaletteGroups(PALETTE_GROUPS, "DRIZZLE"))).toEqual([
      ["Pages", ["Drizzle ORM (Postgres)"]],
    ]);
  });
});

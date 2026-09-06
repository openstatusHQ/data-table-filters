// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DataTableFilterRail } from "@dtf/registry/components/data-table/data-table-filter-rail";
import { CONTROLS_KEY } from "@dtf/registry/lib/constants/local-storage";
import { ControlsProvider } from "@dtf/registry/providers/controls";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * The rail is the hit area on the filter sidebar's border. It drives the same
 * `ControlsContext` as the toolbar's Hide/Show Controls button, so the state it
 * writes has to be the state the CSS reads: `data-expanded` on the
 * `group/controls` wrapper, which is what hides the sidebar.
 */

let container: HTMLDivElement;
let root: Root;

function mount() {
  act(() =>
    root.render(
      <ControlsProvider>
        <DataTableFilterRail />
      </ControlsProvider>,
    ),
  );
}

const rail = () =>
  container.querySelector<HTMLButtonElement>(
    '[data-slot="data-table-filter-rail"]',
  )!;

const group = () => container.querySelector<HTMLElement>(".group\\/controls")!;

beforeEach(() => {
  localStorage.clear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  localStorage.clear();
});

describe("DataTableFilterRail", () => {
  it("toggles the controls state the sidebar's CSS reads", () => {
    mount();

    expect(group().dataset.expanded).toBe("true");
    expect(rail().getAttribute("aria-expanded")).toBe("true");

    act(() => rail().click());

    expect(group().dataset.expanded).toBe("false");
    expect(rail().getAttribute("aria-expanded")).toBe("false");

    act(() => rail().click());

    expect(group().dataset.expanded).toBe("true");
  });

  it("persists the collapsed state so it survives a remount", async () => {
    mount();
    // `useLocalStorage` defers the write to a microtask so it never blocks the
    // interaction, so the assertion has to let that drain.
    await act(async () => {
      rail().click();
    });

    expect(JSON.parse(localStorage.getItem(CONTROLS_KEY)!)).toBe(false);

    act(() => root.unmount());
    root = createRoot(container);
    mount();

    expect(group().dataset.expanded).toBe("false");
  });

  it("stays out of the tab order — the toolbar button is the accessible control", () => {
    mount();

    // Duplicating the toggle in the tab order would make it a second, unlabeled
    // stop on a control that is purely a pointer affordance.
    expect(rail().tabIndex).toBe(-1);
    expect(rail().getAttribute("aria-label")).toBe("Toggle Filters");
  });

  it("is positioned against the table column, not the page", () => {
    // `absolute inset-y-0` only lands on the sidebar border if the column that
    // renders the rail establishes the containing block. jsdom has no layout
    // engine, so the source is the only place this contract is observable.
    const source = readFileSync(
      join(__dirname, "data-table-infinite.tsx"),
      "utf8",
    );

    // Class-order-tolerant: `cn` is a `tailwindFunctions` entry, so prettier
    // re-sorts this list whenever a class is added. Pin `relative` on the
    // element that owns `sm:border-l`, not the string prettier happens to emit.
    const column = source.match(/className=\{cn\(\s*"[^"]*sm:border-l[^"]*"/);
    expect(column).not.toBeNull();
    expect(column?.[0]).toMatch(/\brelative\b/);
    expect(source).toMatch(/<DataTableFilterRail \/>/);
  });
});

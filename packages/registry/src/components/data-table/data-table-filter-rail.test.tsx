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
    // re-sorts and may split this list whenever a class is added. Pin
    // `relative` on the element that renders the rail — the `cn(` block
    // immediately preceding it — not the string prettier happens to emit.
    const railAt = source.indexOf("<DataTableFilterRail />");
    expect(railAt).toBeGreaterThan(-1);
    const columnAt = source.lastIndexOf("className={cn(", railAt);
    expect(columnAt).toBeGreaterThan(-1);
    const column = source.slice(columnAt, railAt);
    expect(column).toMatch(/\bsm:border-l\b/);
    expect(column).toMatch(/\brelative\b/);
  });

  it("collapses the sidebar by width so the toggle animates, and inerts it while closed", () => {
    // `display: none` can't be transitioned. The panel mirrors the shadcn
    // sidebar instead: `w-0` + `transition-[width]`, with the inner wrapper
    // holding the open width so content slides out rather than reflowing.
    // Because the filters stay in the DOM while collapsed, they have to be
    // `inert` or they would remain focusable behind an invisible box.
    const source = readFileSync(
      join(__dirname, "data-table-infinite.tsx"),
      "utf8",
    );

    const panelAt = source.indexOf("function FilterPanel(");
    expect(panelAt).toBeGreaterThan(-1);
    const panel = source.slice(panelAt, source.indexOf("\n}\n", panelAt));

    expect(panel).toMatch(/inert=\{!open\}/);
    expect(panel).toMatch(/group-data-\[expanded=false\]\/controls:w-0/);
    expect(panel).toMatch(/transition-\[width\]/);
    expect(panel).toMatch(/motion-reduce:transition-none/);
    expect(source).not.toMatch(
      /group-data-\[expanded=false\]\/controls:hidden/,
    );
  });
});

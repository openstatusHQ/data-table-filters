// @vitest-environment jsdom

import {
  Sheet,
  SheetClose,
  SheetContent,
} from "@dtf/registry/components/custom/sheet";
import {
  Sortable,
  SortableItem,
} from "@dtf/registry/components/custom/sortable";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * `asChild` (Radix) and `render` (Base UI) on the components this block ships.
 *
 * The shadcn CLI rewrites `asChild` into `render={<child />}` on its way into a
 * Base UI project, including inside files the block owns — `sheet` and
 * `sortable` are built on Radix either way, so they have to accept the prop the
 * CLI writes. The install CI proves the rewritten code typechecks; this proves
 * it renders the same thing: one element, the caller's, with the children
 * inside it and no wrapper.
 */

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function mount(ui: ReactNode) {
  act(() => root.render(ui));
}

describe("SortableItem composition", () => {
  const sortable = (children: ReactNode) => (
    <Sortable value={[{ id: "a" }]}>{children}</Sortable>
  );

  it("renders as the element given to `render`, with the children inside", () => {
    mount(
      sortable(
        <SortableItem
          value="a"
          className="cursor-grabbing"
          render={<button type="button" data-testid="item" />}
        >
          <span>label</span>
        </SortableItem>,
      ),
    );

    const item = container.querySelector<HTMLButtonElement>(
      '[data-testid="item"]',
    )!;
    expect(item.tagName).toBe("BUTTON");
    expect(item.className).toContain("cursor-grabbing");
    expect(item.querySelector("span")?.textContent).toBe("label");
    // The children belong to the render element, not beside it, and the item's
    // own props land on that element rather than on a wrapper around it.
    expect(container.querySelectorAll("span")).toHaveLength(1);
    expect(container.querySelectorAll(".cursor-grabbing")).toHaveLength(1);
  });

  it("still merges into its child for `asChild`", () => {
    mount(
      sortable(
        <SortableItem value="a" className="cursor-grabbing" asChild>
          <button type="button" data-testid="item">
            <span>label</span>
          </button>
        </SortableItem>,
      ),
    );

    const item = container.querySelector<HTMLButtonElement>(
      '[data-testid="item"]',
    )!;
    expect(item.tagName).toBe("BUTTON");
    expect(item.className).toContain("cursor-grabbing");
    expect(container.querySelectorAll(".cursor-grabbing")).toHaveLength(1);
  });

  it("wraps in a div when given neither", () => {
    mount(
      sortable(
        <SortableItem value="a" className="cursor-grabbing">
          plain
        </SortableItem>,
      ),
    );

    const item = container.querySelector<HTMLDivElement>(".cursor-grabbing")!;
    expect(item.tagName).toBe("DIV");
    expect(item.textContent).toBe("plain");
  });
});

describe("SheetClose composition", () => {
  const openSheet = (close: ReactNode) => (
    <Sheet open>
      <SheetContent>{close}</SheetContent>
    </Sheet>
  );

  it("renders as the element given to `render`, with the children inside", () => {
    mount(
      openSheet(
        <SheetClose render={<button type="button" data-testid="close" />}>
          <span>Close</span>
        </SheetClose>,
      ),
    );

    // The sheet content is portalled, so it lands on the body, not `container`.
    const close = document.body.querySelector<HTMLButtonElement>(
      '[data-testid="close"]',
    )!;
    expect(close.tagName).toBe("BUTTON");
    expect(close.querySelector("span")?.textContent).toBe("Close");
    expect(
      document.body.querySelectorAll('[data-testid="close"]'),
    ).toHaveLength(1);
  });

  it("renders its own button without `render`", () => {
    mount(openSheet(<SheetClose data-testid="close">Close</SheetClose>));

    const close = document.body.querySelector<HTMLButtonElement>(
      '[data-testid="close"]',
    )!;
    expect(close.tagName).toBe("BUTTON");
    expect(close.textContent).toBe("Close");
  });
});

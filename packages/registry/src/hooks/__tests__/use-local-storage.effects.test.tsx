// @vitest-environment jsdom

import { useLocalStorage } from "@dtf/registry/hooks/use-local-storage";
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * The sibling `use-local-storage.test.ts` renders once with
 * `renderToStaticMarkup`, which never runs effects. That is the right tool for
 * the hydration regression it pins — but it means the hook's actual behaviour
 * (the post-mount read, key changes, write-through) went uncovered.
 *
 * These tests mount for real in jsdom and flush effects with `act`, so they
 * exercise the paths a render-only test cannot reach. React 19 ships `act`
 * itself, so this needs no testing-library dependency — only a DOM.
 */

type Probe = {
  value: unknown;
  setValue: (next: unknown) => void;
  setKey: (next: string) => void;
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  window.localStorage.clear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

/**
 * Mounts the hook and exposes a handle to drive it. `initialValueFor` lets a
 * test give each key its own defaults, which is how the stale-defaults bug
 * shows up.
 */
function mount(
  initialKey: string,
  initialValueFor: (key: string) => unknown,
): Probe {
  const probe = {} as Probe;

  function Component() {
    const [key, setKey] = useState(initialKey);
    const [value, setValue] = useLocalStorage(key, initialValueFor(key));
    probe.value = value;
    probe.setValue = setValue as (next: unknown) => void;
    probe.setKey = setKey;
    return null;
  }

  act(() => root.render(<Component />));
  return probe;
}

describe("useLocalStorage — after mount", () => {
  it("picks up the stored value once effects have run", () => {
    window.localStorage.setItem("last-searches", JSON.stringify(["stored"]));

    const probe = mount("last-searches", () => []);

    expect(probe.value).toEqual(["stored"]);
  });

  it("keeps the initial value when nothing is stored", () => {
    const probe = mount("column-order", () => ["id"]);

    expect(probe.value).toEqual(["id"]);
  });

  it("writes through to localStorage", async () => {
    const probe = mount("last-searches", () => [] as string[]);

    await act(async () => {
      probe.setValue(["written"]);
      // The hook defers the write with queueMicrotask.
      await Promise.resolve();
    });

    expect(probe.value).toEqual(["written"]);
    expect(window.localStorage.getItem("last-searches")).toBe(
      JSON.stringify(["written"]),
    );
  });

  it("does not clobber a value written before the mount effect flushed", () => {
    window.localStorage.setItem("last-searches", JSON.stringify(["stored"]));

    const probe = mount("last-searches", () => [] as string[]);
    act(() => probe.setValue(["fresh"]));

    expect(probe.value).toEqual(["fresh"]);
  });
});

describe("useLocalStorage — key changes", () => {
  it("re-reads storage for the new key", () => {
    window.localStorage.setItem("key-a", JSON.stringify(["a"]));
    window.localStorage.setItem("key-b", JSON.stringify(["b"]));

    const probe = mount("key-a", () => []);
    expect(probe.value).toEqual(["a"]);

    act(() => probe.setKey("key-b"));
    expect(probe.value).toEqual(["b"]);
  });

  it("uses the new key's defaults, not the first render's", () => {
    // Regression: `initialValueRef` was captured once with `useRef(initialValue)`
    // and never updated, so switching to a key with no stored value fell back to
    // whatever the *first* key's defaults happened to be.
    const defaults: Record<string, unknown> = {
      "key-a": ["default-a"],
      "key-b": ["default-b"],
    };

    const probe = mount("key-a", (key) => defaults[key]);
    expect(probe.value).toEqual(["default-a"]);

    act(() => probe.setKey("key-b"));
    expect(probe.value).toEqual(["default-b"]);
  });

  it("hydrates a new key even when the old key was just written to", () => {
    // Behaviour lock, NOT a regression test: this passes against the previous
    // bare-boolean dirty flag too.
    //
    // That flag was reported as key-unscoped, and it was — but the losing race
    // needs a write *and* a key change to land before the hook's mount passive
    // effect flushes, and React always flushes that effect before a later
    // commit's effects (driving it from a layout effect does not change this).
    // I could not construct a failing case. The ref is still scoped to its key
    // because that is unambiguously correct and self-documenting, but the
    // scoping is defensive, not a fix for anything observed.
    window.localStorage.setItem("key-b", JSON.stringify(["b"]));

    const probe = mount("key-a", () => [] as string[]);
    act(() => {
      probe.setValue(["written-to-a"]);
      probe.setKey("key-b");
    });

    expect(probe.value).toEqual(["b"]);
  });
});

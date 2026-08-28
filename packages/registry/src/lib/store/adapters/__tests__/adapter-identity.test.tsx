// @vitest-environment jsdom

import { useMemoryAdapter } from "@dtf/registry/lib/store/adapters/memory";
import { useNuqsAdapter } from "@dtf/registry/lib/store/adapters/nuqs";
import { useZustandAdapter } from "@dtf/registry/lib/store/adapters/zustand";
import { createFilterSlice } from "@dtf/registry/lib/store/adapters/zustand/slice";
import { createSchema, field } from "@dtf/registry/lib/store/schema";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { create } from "zustand";

/**
 * Every consumer treats the adapter as a stable identity: `DataTableStoreProvider`
 * memoizes its context value on it, `useFilterActions` memoizes `setFilters` on
 * it, and `useFilterState` memoizes `subscribe` on it. `DataTableInfinite` then
 * puts `setFilters` in the dep array of the `onRowClick` it hands to every
 * memoized row.
 *
 * So an adapter that changes identity on every render silently defeats row
 * memoization for the whole table — every row re-renders on every render of the
 * table, which is what selecting a single row looked like. `useNuqsAdapter` did
 * exactly that: nuqs's own `useAdapter()` returns a fresh object literal per
 * render, so the `setNuqsState` in this hook's dep array was never stable.
 */

const schema = createSchema({
  uuid: field.string(),
  host: field.string(),
});

let container: HTMLDivElement;
let root: Root;
let adapters: unknown[];
let forceRender: () => void;

function useForceRender() {
  const [, setTick] = useState(0);
  forceRender = () => setTick((t) => t + 1);
}

beforeEach(() => {
  adapters = [];
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("store adapter identity", () => {
  it("useMemoryAdapter keeps one reference across re-renders", () => {
    function Probe() {
      useForceRender();
      adapters.push(useMemoryAdapter(schema.definition, { id: "test" }));
      return null;
    }

    act(() => root.render(<Probe />));
    act(() => forceRender());
    act(() => forceRender());

    expect(adapters.length).toBeGreaterThan(2);
    expect(new Set(adapters).size).toBe(1);
  });

  it("useNuqsAdapter keeps one reference across re-renders", () => {
    function Probe() {
      useForceRender();
      adapters.push(
        useNuqsAdapter<Record<string, unknown>>(schema.definition, {
          id: "test",
        }),
      );
      return null;
    }

    act(() =>
      root.render(
        <NuqsTestingAdapter searchParams="?host=api.example.com">
          <Probe />
        </NuqsTestingAdapter>,
      ),
    );
    act(() => forceRender());
    act(() => forceRender());

    expect(adapters.length).toBeGreaterThan(2);
    expect(new Set(adapters).size).toBe(1);
  });

  it("useNuqsAdapter keeps one reference across a state write", () => {
    function Probe() {
      adapters.push(
        useNuqsAdapter<Record<string, unknown>>(schema.definition, {
          id: "test",
        }),
      );
      return null;
    }

    act(() =>
      root.render(
        <NuqsTestingAdapter searchParams="?host=api.example.com">
          <Probe />
        </NuqsTestingAdapter>,
      ),
    );

    const adapter = adapters[0] as ReturnType<
      typeof useNuqsAdapter<Record<string, unknown>>
    >;
    act(() => adapter.setState({ uuid: "row-b" }));

    expect(adapters.length).toBeGreaterThan(1);
    expect(new Set(adapters).size).toBe(1);
  });

  it("useZustandAdapter keeps one reference across re-renders", () => {
    const useStore = create<Record<string, unknown>>((set, get) => ({
      ...createFilterSlice(schema.definition, "test", set, get),
    }));

    function Probe() {
      useForceRender();
      adapters.push(
        useZustandAdapter(useStore, schema.definition, { id: "test" }),
      );
      return null;
    }

    act(() => root.render(<Probe />));
    act(() => forceRender());
    act(() => forceRender());

    expect(adapters.length).toBeGreaterThan(2);
    expect(new Set(adapters).size).toBe(1);
  });
});

// @vitest-environment jsdom

import { useMemoryAdapter } from "@dtf/registry/lib/store/adapters/memory";
import { useFilterActions } from "@dtf/registry/lib/store/hooks/useFilterActions";
import { useFilterState } from "@dtf/registry/lib/store/hooks/useFilterState";
import { DataTableStoreProvider } from "@dtf/registry/lib/store/provider/DataTableStoreProvider";
import { createSchema, field } from "@dtf/registry/lib/store/schema";
import { act, memo } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * `DataTableInfinite` used to read the detail row id at the table level and pass
 * it down to every row, so picking a row re-rendered all of them — O(rows) work
 * per click, on a table whose row count only grows as you scroll. Each row now
 * subscribes to the store itself and selects a *boolean*, which lets
 * `useSyncExternalStore` bail out for every row whose detail state did not flip.
 *
 * These tests pin that bail-out: it is a property of the adapter's snapshot
 * identity, not of the row component, so a future adapter that returned a fresh
 * state object per read would silently bring the O(rows) behaviour back.
 */

const schema = createSchema({
  uuid: field.string(),
  live: field.boolean().default(false),
});

const ROW_IDS = ["row-a", "row-b", "row-c", "row-d"];

let container: HTMLDivElement;
let root: Root;
let renders: Record<string, number>;
let setFilters: (partial: Record<string, unknown>) => void;

const RowProbe = memo(function RowProbe({ rowId }: { rowId: string }) {
  const isDetail = useFilterState<Record<string, unknown>, boolean>(
    (s) => s.uuid === rowId,
  );
  renders[rowId] = (renders[rowId] ?? 0) + 1;
  return <div data-detail={isDetail ? "" : undefined} />;
});

function Harness() {
  const adapter = useMemoryAdapter(schema.definition, { id: "test" });
  return (
    <DataTableStoreProvider adapter={adapter}>
      <Actions />
      {ROW_IDS.map((rowId) => (
        <RowProbe key={rowId} rowId={rowId} />
      ))}
    </DataTableStoreProvider>
  );
}

function Actions() {
  const actions = useFilterActions<Record<string, unknown>>();
  setFilters = actions.setFilters;
  return null;
}

beforeEach(() => {
  renders = {};
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<Harness />));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("useFilterState with a boolean selector", () => {
  it("re-renders only the row that becomes the detail row", () => {
    const before = { ...renders };

    act(() => setFilters({ uuid: "row-b" }));

    expect(renders["row-b"]).toBe(before["row-b"]! + 1);
    for (const rowId of ["row-a", "row-c", "row-d"]) {
      expect(renders[rowId]).toBe(before[rowId]);
    }
  });

  it("re-renders only the two rows whose detail state flips", () => {
    act(() => setFilters({ uuid: "row-b" }));
    const before = { ...renders };

    act(() => setFilters({ uuid: "row-d" }));

    expect(renders["row-b"]).toBe(before["row-b"]! + 1);
    expect(renders["row-d"]).toBe(before["row-d"]! + 1);
    for (const rowId of ["row-a", "row-c"]) {
      expect(renders[rowId]).toBe(before[rowId]);
    }
  });

  it("re-renders no rows when an unrelated field changes", () => {
    const before = { ...renders };

    act(() => setFilters({ live: true }));

    for (const rowId of ROW_IDS) {
      expect(renders[rowId]).toBe(before[rowId]);
    }
  });

  it("clears the detail row without touching the others", () => {
    act(() => setFilters({ uuid: "row-c" }));
    const before = { ...renders };

    act(() => setFilters({ uuid: null }));

    expect(renders["row-c"]).toBe(before["row-c"]! + 1);
    for (const rowId of ["row-a", "row-b", "row-d"]) {
      expect(renders[rowId]).toBe(before[rowId]);
    }
  });
});

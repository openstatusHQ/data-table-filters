// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  dataTableFeatures,
  type DataTableFeatures,
} from "@dtf/registry/lib/table/features";
import {
  useTable,
  type ColumnDef,
  type ReactTable,
  type TableOptions,
} from "@tanstack/react-table";
import { act, useMemo, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * BREAKING (v9): `useTable` returns
 * `useMemo(() => ({ ...table, options, state }), [table, options, state])`, so
 * the caller — not the library — owns the identity of the table object. An
 * inline options literal makes it change on every render; v8's `useReactTable`
 * returned one stable instance for the life of the component.
 *
 * That identity is load-bearing here: `DataTableProvider` memoizes its context
 * value on `props.table`, so every `useDataTable()` consumer (toolbar, filter
 * controls, command, sheet, floating bar) re-renders whenever it changes, and
 * `useReactTableSync` re-runs its deep `isEqual` sweep over every filter field.
 * `DataTableInfinite` renders on each ResizeObserver tick, `isFetching` flip and
 * 5s live poll, so unmemoized options meant all of that on all of them.
 */

type Item = { id: string };

const data: Item[] = [{ id: "a" }];
const columns: ColumnDef<DataTableFeatures, Item>[] = [{ accessorKey: "id" }];

let container: HTMLDivElement;
let root: Root;
let tables: ReactTable<DataTableFeatures, Item>[];
let forceRender: () => void;

function Probe({ memoize }: { memoize: boolean }) {
  const [, setTick] = useState(0);
  forceRender = () => setTick((t) => t + 1);

  const memoized = useMemo<TableOptions<DataTableFeatures, Item>>(
    () => ({
      features: dataTableFeatures,
      data,
      columns,
      getRowId: (item) => item.id,
      manualPagination: true,
    }),
    [],
  );

  const inline: TableOptions<DataTableFeatures, Item> = {
    features: dataTableFeatures,
    data,
    columns,
    getRowId: (item) => item.id,
    manualPagination: true,
  };

  tables.push(useTable(memoize ? memoized : inline));
  return null;
}

function mount(memoize: boolean) {
  act(() => root.render(<Probe memoize={memoize} />));
}

beforeEach(() => {
  tables = [];
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("useTable — returned identity", () => {
  it("keeps one table reference across re-renders when the options are memoized", () => {
    mount(true);
    act(() => forceRender());
    act(() => forceRender());

    expect(tables.length).toBeGreaterThanOrEqual(3);
    expect(new Set(tables).size).toBe(1);
  });

  /** The failure mode, pinned: this is what an inline options literal costs. */
  it("returns a new table reference on every render when they are not", () => {
    mount(false);
    act(() => forceRender());

    expect(new Set(tables).size).toBe(tables.length);
  });
});

/**
 * The blocks above are about the library; these are about our use of it — the
 * call sites the provider actually wraps.
 */
describe("DataTableInfinite — memoized options", () => {
  it("passes a memoized options object to useTable", () => {
    const source = readFileSync(
      join(__dirname, "data-table-infinite.tsx"),
      "utf8",
    );

    expect(source).toMatch(/const tableOptions = React\.useMemo\(/);
    expect(source).toMatch(/useTable\(tableOptions\)/);
    // An options literal passed straight to the hook is the regression.
    expect(source).not.toMatch(/useTable\(\{/);
  });
});

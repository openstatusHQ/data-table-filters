// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  dataTableFeatures,
  type DataTableFeatures,
} from "@dtf/registry/lib/table/features";
import {
  flexRender,
  Subscribe,
  useTable,
  type ColumnDef,
  type Row,
  type Table,
} from "@tanstack/react-table";
import { act, useRef, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * Regression: checking a row must actually check its checkbox.
 *
 * `DataTableInfinite` renders its cells inside `<Subscribe>` so the row can
 * re-read `columnVisibility` / `columnOrder` without the whole table
 * re-rendering. Compiled by the React Compiler, that turns into:
 *
 *   let t3;                                   // the children callback
 *   if ($[4] !== row) { t3 = () => row.getVisibleCells().map(_temp3); … }
 *   let t4;                                   // the <Subscribe> element
 *   if ($[6] !== row.table.store || $[7] !== t3) { t4 = <Subscribe …>{t3}</…>; … }
 *
 * Selection does not rebuild the core row model, so `row` — and therefore `t3`
 * and `t4` — stay identical. React sees the same element and bails out of the
 * whole subtree, so no prop change on `Row` and no parent re-render can reach
 * the cells. The `<tr>` above them is rebuilt (its `data-checked` depends on
 * the `selected` prop), which is exactly what the bug looked like: select all,
 * every row lights up, every checkbox stays empty.
 *
 * The fix is that `Subscribe`'s own store subscription is the only thing that
 * can re-run those cells, so every state slice they render from has to be in
 * its selector — row selection included.
 */

type Item = { id: string };

const data: Item[] = [{ id: "a" }, { id: "b" }, { id: "c" }];

const columns: ColumnDef<DataTableFeatures, Item>[] = [
  {
    id: "select",
    // Stands in for the registry's checkbox cell: the point is that it reads
    // selection through a method call, behind the memo boundary.
    cell: ({ row }) => (row.getIsSelected() ? "checked" : "unchecked"),
  },
  { accessorKey: "id" },
];

/** Which slices the row hands to `<Subscribe>`. */
type SelectorMode = "without-row-selection" | "with-row-selection";

let container: HTMLDivElement;
let root: Root;
// Collected via an array rather than a `let`: TypeScript cannot see that the
// assignment inside the harness runs, and narrows a nullable local to `never`.
const tables: Table<DataTableFeatures, Item>[] = [];

/**
 * A row whose cell subtree is memoized exactly the way the compiler memoizes
 * `Row` in `data-table-infinite.tsx`: the children callback is cached on `row`
 * identity, and the `<Subscribe>` element on that callback. Hand-rolled because
 * vitest does not run babel-plugin-react-compiler — without this, the bug is
 * invisible in a test and reproduces only in the built app.
 */
function CompiledRow({
  row,
  mode,
}: {
  row: Row<DataTableFeatures, Item>;
  mode: SelectorMode;
}) {
  const cache = useRef<{
    row: Row<DataTableFeatures, Item> | null;
    element: ReactNode;
  }>({ row: null, element: null });

  if (cache.current.row !== row) {
    const children = () =>
      row.getVisibleCells().map((cell) => (
        <td key={cell.id} data-cell={cell.column.id}>
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </td>
      ));

    cache.current = {
      row,
      element: (
        <Subscribe
          source={row.table.store}
          selector={(state) =>
            mode === "with-row-selection"
              ? {
                  columnVisibility: state.columnVisibility,
                  columnOrder: state.columnOrder,
                  selected: state.rowSelection?.[row.id] ?? false,
                }
              : {
                  columnVisibility: state.columnVisibility,
                  columnOrder: state.columnOrder,
                }
          }
        >
          {children}
        </Subscribe>
      ),
    };
  }

  // Not memoized, mirroring the `<TableRow>` wrapper: it is rebuilt on every
  // parent render, which is why the row styling flipped while the cells didn't.
  return (
    <tr data-checked={row.getIsSelected() ? "" : undefined}>
      {cache.current.element}
    </tr>
  );
}

function Harness({ mode }: { mode: SelectorMode }) {
  const table = useTable({
    features: dataTableFeatures,
    data,
    columns,
    getRowId: (item) => item.id,
    manualPagination: true,
  });
  tables[0] = table;
  return (
    <table>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <CompiledRow key={row.id} row={row} mode={mode} />
        ))}
      </tbody>
    </table>
  );
}

function mount(mode: SelectorMode) {
  act(() => root.render(<Harness mode={mode} />));
}

function table() {
  const instance = tables[0];
  if (!instance) throw new Error("Harness did not render");
  return instance;
}

/** What each row's select cell currently shows. */
function cells() {
  return Array.from(
    container.querySelectorAll<HTMLElement>('td[data-cell="select"]'),
    (cell) => cell.textContent,
  );
}

/** What each row's `data-checked` attribute currently says. */
function rows() {
  return Array.from(
    container.querySelectorAll<HTMLElement>("tr"),
    (row) => row.dataset.checked === "",
  );
}

beforeEach(() => {
  tables.length = 0;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("memoized cell subtree — row selection", () => {
  it("re-renders the cells of every row when all rows are selected", () => {
    mount("with-row-selection");

    act(() => table().toggleAllRowsSelected(true));

    expect(cells()).toEqual(["checked", "checked", "checked"]);
    expect(rows()).toEqual([true, true, true]);
  });

  it("re-renders the cells of only the row that is toggled", () => {
    mount("with-row-selection");

    act(() => table().getRow("b").toggleSelected(true));

    expect(cells()).toEqual(["unchecked", "checked", "unchecked"]);
  });

  it("re-renders the cells when selection is cleared again", () => {
    mount("with-row-selection");

    act(() => table().toggleAllRowsSelected(true));
    act(() => table().toggleAllRowsSelected(false));

    expect(cells()).toEqual(["unchecked", "unchecked", "unchecked"]);
    expect(rows()).toEqual([false, false, false]);
  });

  /**
   * The failure mode itself, pinned so the selector cannot quietly shrink back.
   * Dropping the slice does not break the table state or the row styling — only
   * the cells go stale — so nothing else in the suite would notice.
   */
  it("leaves the cells stale when the selector omits row selection", () => {
    mount("without-row-selection");

    act(() => table().toggleAllRowsSelected(true));

    expect(table().getIsAllRowsSelected()).toBe(true);
    expect(rows()).toEqual([true, true, true]);
    expect(cells()).toEqual(["unchecked", "unchecked", "unchecked"]);
  });
});

/**
 * The block above is about React and the library; this is about our use of it.
 * Same reasoning as `features.pagination.test.tsx`: reading the source is the
 * only way to pin a contract that lives in a file no test can render compiled.
 */
describe("DataTableInfinite — Subscribe selector", () => {
  it("selects this row's selection alongside the column slices", () => {
    const source = readFileSync(
      join(__dirname, "data-table-infinite.tsx"),
      "utf8",
    );

    // Whitespace-tolerant, and delimited by the element's own tags rather than
    // by the selector's braces: prettier is free to reformat the arrow body.
    const subscribe = source.match(/<Subscribe[\s\S]*?<\/Subscribe>/);
    expect(subscribe).not.toBeNull();
    expect(subscribe?.[0]).toMatch(/state\.columnVisibility/);
    expect(subscribe?.[0]).toMatch(/state\.columnOrder/);
    expect(subscribe?.[0]).toMatch(/state\.rowSelection\??\.\[row\.id\]/);
  });
});

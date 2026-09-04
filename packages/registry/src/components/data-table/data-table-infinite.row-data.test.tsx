// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  dataTableFeatures,
  type DataTableFeatures,
} from "@dtf/registry/lib/table/features";
import {
  flexRender,
  useTable,
  type ColumnDef,
  type Row,
} from "@tanstack/react-table";
import { act, memo } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * Regression: a row action edits a row in place, and the edit has to show.
 *
 * `MemoizedRow` exists because `createCoreRowModel` memoizes on
 * `[table.options.data]`, so every `fetchNextPage` hands back new `row` objects
 * for rows that did not change. Comparing by `row.id` alone made that cheap and
 * was correct as long as the list only ever grew. Row actions broke the
 * assumption: after `invalidateQueries` the refetched row keeps its id and
 * carries new contents, and the comparator claimed nothing had changed — the
 * old cells stayed on screen until a filter change or a reload rebuilt the
 * table. A delete hid the bug, because the row left the list entirely.
 *
 * `row.original` is the identity of the underlying record, so a row the server
 * changed always re-renders. What it does *not* do is keep the memo effective
 * across a full refetch: react-query's `replaceEqualDeep` hands back a fresh
 * object for every row once the payload holds a `Date` (`ColumnSchema.date`
 * does), so an action's invalidation re-renders the mounted rows whether or not
 * it touched them. The path the comparator was written for is unaffected —
 * `fetchNextPage` appends a page and leaves earlier ones referentially intact —
 * and that is the distinction the two cases below pin.
 */

type Item = { id: string; level: string };

const columns: ColumnDef<DataTableFeatures, Item>[] = [
  { id: "level", accessorKey: "level" },
];

/** Which identity the memo compares — the bug, and the fix. */
type CompareMode = "id-only" | "id-and-original";

let container: HTMLDivElement;
let root: Root;
/** How many times each row rendered its cells, keyed by row id. */
const renders = new Map<string, number>();

function RowCells({
  row,
}: {
  row: Row<DataTableFeatures, Item>;
  mode: CompareMode;
}) {
  renders.set(row.id, (renders.get(row.id) ?? 0) + 1);
  return (
    <tr>
      {row.getVisibleCells().map((cell) => (
        <td key={cell.id} data-cell={row.id}>
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </td>
      ))}
    </tr>
  );
}

/**
 * Stands in for `MemoizedRow`. Hand-rolled with the comparator as a prop so the
 * test can mount both the old contract and the current one; the props the real
 * comparator also checks (`selected`, `onRowClick`, …) are constant here.
 */
const MemoizedRow = memo(
  RowCells,
  (prev, next) =>
    prev.row.id === next.row.id &&
    (prev.mode === "id-only" || prev.row.original === next.row.original) &&
    prev.mode === next.mode,
);

function Harness({ data, mode }: { data: Item[]; mode: CompareMode }) {
  const table = useTable({
    features: dataTableFeatures,
    data,
    columns,
    getRowId: (item) => item.id,
    manualPagination: true,
  });
  return (
    <table>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <MemoizedRow key={row.id} row={row} mode={mode} />
        ))}
      </tbody>
    </table>
  );
}

/** What each row's cell currently shows, keyed by row id. */
function cells() {
  return Object.fromEntries(
    Array.from(
      container.querySelectorAll<HTMLElement>("td[data-cell]"),
      (cell) => [cell.dataset.cell, cell.textContent],
    ),
  );
}

beforeEach(() => {
  renders.clear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

/**
 * A refetch after an action, as react-query actually hands it over: every row
 * is a fresh object, because one `Date` on the row defeats structural sharing.
 */
function afterAction(data: Item[], id: string, level: string): Item[] {
  return data.map((item) =>
    item.id === id ? { ...item, level } : { ...item },
  );
}

/**
 * A `fetchNextPage`, as react-query hands *that* over: the pages already in the
 * cache are reused verbatim, so the rows on screen keep their identity even
 * though the core row model is rebuilt around them.
 */
function afterFetchNextPage(data: Item[], appended: Item): Item[] {
  return [...data, appended];
}

describe("memoized row — data changes under a stable row id", () => {
  const data: Item[] = [
    { id: "a", level: "error" },
    { id: "b", level: "error" },
    { id: "c", level: "info" },
  ];

  it("re-renders the row an action edited in place", () => {
    act(() => root.render(<Harness data={data} mode="id-and-original" />));
    expect(cells()).toEqual({ a: "error", b: "error", c: "info" });

    act(() =>
      root.render(
        <Harness
          data={afterAction(data, "b", "warning")}
          mode="id-and-original"
        />,
      ),
    );

    expect(cells()).toEqual({ a: "error", b: "warning", c: "info" });
  });

  it("does not re-render the rows on screen when a page is appended", () => {
    act(() => root.render(<Harness data={data} mode="id-and-original" />));
    act(() =>
      root.render(
        <Harness
          data={afterFetchNextPage(data, { id: "d", level: "info" })}
          mode="id-and-original"
        />,
      ),
    );

    // The optimization the comparator exists for, and the reason `original` is
    // the right thing to compare: same record, same render, however many times
    // the core row model is rebuilt around it.
    expect(renders.get("a")).toBe(1);
    expect(renders.get("b")).toBe(1);
    expect(renders.get("c")).toBe(1);
    expect(renders.get("d")).toBe(1);
  });

  /**
   * The failure mode itself. Nothing else notices it: the table state is
   * correct, the row is still there, only its cells are stale.
   */
  it("goes stale when the comparator only checks the row id", () => {
    act(() => root.render(<Harness data={data} mode="id-only" />));
    act(() =>
      root.render(
        <Harness data={afterAction(data, "b", "warning")} mode="id-only" />,
      ),
    );

    expect(cells()).toEqual({ a: "error", b: "error", c: "info" });
  });
});

/**
 * The block above is about React; this is about our use of it. Same reasoning
 * as the `Subscribe` selector test: reading the source is the only way to pin a
 * contract in a file no test can render compiled.
 */
describe("DataTableInfinite — MemoizedRow comparator", () => {
  it("compares the underlying record alongside the row id", () => {
    const source = readFileSync(
      join(__dirname, "data-table-infinite.tsx"),
      "utf8",
    );

    const comparator = source.match(
      /const MemoizedRow = React\.memo\([\s\S]*?\n\) as typeof Row;/,
    );
    expect(comparator).not.toBeNull();
    expect(comparator?.[0]).toMatch(/prev\.row\.id === next\.row\.id/);
    expect(comparator?.[0]).toMatch(
      /prev\.row\.original === next\.row\.original/,
    );
  });
});

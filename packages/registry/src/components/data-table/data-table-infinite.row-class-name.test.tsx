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
  type Row,
  type TableOptions,
} from "@tanstack/react-table";
import { act, memo, useMemo, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * Regression: toggling live mode has to restyle the rows that are on screen.
 *
 * `getRowClassName` closes over the live-mode timestamp, so its *result*
 * changes while `row` does not. Reading it back off `row.table.options.meta`
 * hid it from both memo boundaries the row sits behind:
 *
 *   - the `MemoizedRow` comparator, which only ever saw `row`/`selected`, so a
 *     new callback never reached `Row` at all; and
 *   - the React Compiler, which caches `cn(…, row.table.options.meta
 *     ?.getRowClassName?.(row))` on `row` identity alone.
 *
 * Turning live mode off triggers no refetch (`live` is not in the query key),
 * so the row model is not rebuilt and every row stayed at `opacity-50`. The
 * `useFilterState((s) => s.live)` subscription that used to force a re-render
 * could not fix that — a re-render does not invalidate a cache keyed on `row`.
 *
 * The fix is to pass the callback as a prop, which both boundaries can see.
 */

type Item = { id: string };

const data: Item[] = [{ id: "a" }, { id: "b" }];

const columns: ColumnDef<DataTableFeatures, Item>[] = [{ accessorKey: "id" }];

/** How the row gets at `getRowClassName`. */
type Mode = "prop" | "meta";

let container: HTMLDivElement;
let root: Root;

/**
 * `Row`'s className computation, memoized the way the compiler memoizes it:
 * cached on `row` identity plus whatever else the expression names. In "meta"
 * mode the callback is behind `row.table.options.meta`, so it is not named and
 * not a dependency — which is the bug.
 */
function CompiledRow({
  row,
  mode,
  getRowClassName,
}: {
  row: Row<DataTableFeatures, Item>;
  mode: Mode;
  getRowClassName?: (row: Row<DataTableFeatures, Item>) => string;
}) {
  const cache = useRef<{
    key: unknown[];
    className: string | undefined;
  } | null>(null);

  const key =
    mode === "prop" ? [row, getRowClassName] : [row as unknown as unknown];

  if (
    !cache.current ||
    cache.current.key.length !== key.length ||
    cache.current.key.some((value, index) => value !== key[index])
  ) {
    cache.current = {
      key,
      className:
        mode === "prop"
          ? getRowClassName?.(row)
          : row.table.options.meta?.getRowClassName?.(row),
    };
  }

  return <tr data-row={row.id} className={cache.current.className} />;
}

const MemoizedRow = memo(
  CompiledRow,
  (prev, next) =>
    prev.row.id === next.row.id &&
    prev.mode === next.mode &&
    // The comparator only learned about the callback once it became a prop.
    (prev.mode === "meta" || prev.getRowClassName === next.getRowClassName),
);

function Harness({ mode, live }: { mode: Mode; live: boolean }) {
  // Stands in for the consumer's inline arrow, memoized by the compiler on the
  // live-mode timestamp it closes over: a new function per live toggle, and the
  // same one across every other render.
  const getRowClassName = useMemo(
    () => () => (live ? "opacity-50" : "opacity-100"),
    [live],
  );

  const tableOptions = useMemo<TableOptions<DataTableFeatures, Item>>(
    () => ({
      features: dataTableFeatures,
      data,
      columns,
      getRowId: (item) => item.id,
      manualPagination: true,
      meta: { getRowClassName },
    }),
    [getRowClassName],
  );

  const table = useTable(tableOptions);

  return (
    <table>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <MemoizedRow
            key={row.id}
            row={row}
            mode={mode}
            getRowClassName={getRowClassName}
          />
        ))}
      </tbody>
    </table>
  );
}

function render(mode: Mode, live: boolean) {
  act(() => root.render(<Harness mode={mode} live={live} />));
}

function classNames() {
  return Array.from(
    container.querySelectorAll<HTMLElement>("tr[data-row]"),
    (row) => row.className,
  );
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("memoized row className — live mode", () => {
  it("restyles every row when live mode is toggled off", () => {
    render("prop", true);
    expect(classNames()).toEqual(["opacity-50", "opacity-50"]);

    // No new data: the row model — and every `row` — is untouched.
    render("prop", false);

    expect(classNames()).toEqual(["opacity-100", "opacity-100"]);
  });

  /**
   * The failure mode itself, pinned so the callback cannot quietly go back
   * behind `table.options.meta`. Nothing else about the table breaks when it
   * does — only the class goes stale — so no other test would notice.
   */
  it("leaves the class stale when the callback is read off table.options.meta", () => {
    render("meta", true);
    expect(classNames()).toEqual(["opacity-50", "opacity-50"]);

    render("meta", false);

    expect(classNames()).toEqual(["opacity-50", "opacity-50"]);
  });
});

/**
 * Same reasoning as the `Subscribe` selector test next door: reading the source
 * is the only way to pin a contract that lives in a file no test can render
 * compiled.
 */
describe("DataTableInfinite — Row className", () => {
  const source = readFileSync(
    join(__dirname, "data-table-infinite.tsx"),
    "utf8",
  );

  it("computes the row class from the prop, not from table.options.meta", () => {
    expect(source).toMatch(
      /className=\{cn\([\s\S]*?getRowClassName\?\.\(row\)/,
    );
    expect(source).not.toMatch(/meta\?\.getRowClassName\?\.\(row\)/);
  });

  it("compares the callback in the MemoizedRow comparator", () => {
    const comparator = source.match(
      /React\.memo\(\s*Row,[\s\S]*?\)\s*as typeof Row/,
    );
    expect(comparator).not.toBeNull();
    expect(comparator?.[0]).toMatch(
      /prev\.getRowClassName === next\.getRowClassName/,
    );
  });
});

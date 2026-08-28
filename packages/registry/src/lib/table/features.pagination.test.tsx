import { readFileSync } from "node:fs";
import { join } from "node:path";
import { useTable, type ColumnDef } from "@tanstack/react-table";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { dataTableFeatures, type DataTableFeatures } from "./features";

/**
 * Regression: server-paginated tables must opt out of the client paginated row
 * model.
 *
 * The registry ships ONE feature set, because `TFeatures` is invariant in v9 and
 * a second set could not share the provider or any shared component type. That
 * set has to register `rowPaginationFeature` + `paginatedRowModel` for the
 * paginated blocks — and v9 routes `getRowModel()` through that slot whenever it
 * exists and `manualPagination` is falsy:
 *
 *   // coreRowModelsFeature.utils.js
 *   if (table.options.manualPagination || !table._rowModels.paginatedRowModel)
 *     return table.getPrePaginatedRowModel()
 *
 * So a table that paginates on the server (`DataTableInfinite`, cursor-based)
 * silently renders only the first `pageSize` — default 10 — rows of everything
 * it fetched. It looks exactly like "Load More is broken": the request goes out,
 * the rows arrive, and the table keeps showing the same ten.
 *
 * Nothing else catches this. It type-checks, it renders, and every other test
 * passes. There is no DOM renderer in this workspace, but `renderToStaticMarkup`
 * runs the real React adapter and the real row-model pipeline in node, which is
 * all this needs.
 */

type Row = { id: number; name: string };

const data: Row[] = Array.from({ length: 42 }, (_, i) => ({
  id: i,
  name: `row-${i}`,
}));

const columns: ColumnDef<DataTableFeatures, Row>[] = [
  { accessorKey: "id" },
  { accessorKey: "name" },
];

/** Renders a table through `useTable` and reports what each row model holds. */
type RowModelCounts = {
  rendered: number;
  prePaginated: number;
  core: number;
};

function renderCounts(options: { manualPagination?: boolean }) {
  // Collected via an array rather than a `let`: TypeScript cannot see that the
  // assignment inside `Probe` runs, and narrows a nullable local to `never`.
  const collected: RowModelCounts[] = [];

  function Probe() {
    const table = useTable({
      features: dataTableFeatures,
      data,
      columns,
      ...options,
    });
    collected.push({
      rendered: table.getRowModel().rows.length,
      prePaginated: table.getPrePaginatedRowModel().rows.length,
      core: table.getCoreRowModel().rows.length,
    });
    return null;
  }

  renderToStaticMarkup(<Probe />);
  const counts = collected[0];
  if (!counts) throw new Error("Probe did not render");
  return counts;
}

describe("dataTableFeatures — pagination routing", () => {
  it("paginates client-side by default, at v9's default page size of 10", () => {
    // What the paginated blocks want, and the reason the slot is registered.
    expect(renderCounts({}).rendered).toBe(10);
  });

  it("renders every fetched row when manualPagination is on", () => {
    // What `DataTableInfinite` relies on. If this drops back to 10, Load More
    // appears broken in the UI while the network tab looks perfectly healthy.
    expect(renderCounts({ manualPagination: true }).rendered).toBe(42);
  });

  it("leaves the pre-paginated and core models whole in both modes", () => {
    // Pins the distinction the bug turned on: the rows are always all there,
    // it is only `getRowModel()` that slices them.
    for (const options of [{}, { manualPagination: true }]) {
      const counts = renderCounts(options);
      expect(counts.prePaginated).toBe(42);
      expect(counts.core).toBe(42);
    }
  });
});

/**
 * The rule above is about the library; this is about our use of it.
 *
 * Without this, deleting `manualPagination` from `DataTableInfinite` would
 * reintroduce the exact bug while every other test stayed green. Reading the
 * source is the same structural check `registry.test.ts` already makes.
 */
describe("DataTableInfinite — server pagination opt-out", () => {
  it("passes manualPagination to useTable", () => {
    const source = readFileSync(
      join(__dirname, "../../components/data-table/data-table-infinite.tsx"),
      "utf8",
    );

    // Anchored on the memoized options object the call site builds, not on the
    // call itself — v9 requires the caller to memoize (see
    // `table-options-identity.test.tsx`), so the literal no longer sits inside
    // `useTable(...)`. Whitespace-tolerant: anchoring on the exact formatting
    // would fail the moment prettier reflowed it, for a reason that has nothing
    // to do with the contract being pinned here.
    const options = source.match(
      /const tableOptions = React\.useMemo\([\s\S]*/,
    );
    expect(options).not.toBeNull();
    expect(options?.[0]).toMatch(/manualPagination\s*:\s*true/);
    expect(source).toMatch(/useTable\(\s*tableOptions\s*\)/);
  });
});

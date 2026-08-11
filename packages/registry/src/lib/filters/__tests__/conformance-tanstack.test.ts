import { getValueAtKey } from "../evaluate";
import { defineFilters } from "../index";
import {
  conformanceRows,
  conformanceSchema,
  runConformance,
} from "../testing/conformance";

/**
 * The TanStack `filterFn`s against the conformance corpus.
 *
 * The registry's vitest environment is "node" and there is no DOM renderer in
 * the workspace, so there is no table instance here — and there does not need to
 * be one. `filters.filterFn(key)` returns a plain predicate over
 * `{ getValue }`, which is the entire surface TanStack calls. Driving it with a
 * stub row proves the client and the server agree on semantics without dragging
 * React into a semantics test.
 */
const filters = defineFilters(conformanceSchema);

runConformance({
  engine: "tanstack (defineFilters().filterFn)",
  select: (testCase) => {
    const filterFn = filters.filterFn(testCase.key);

    // No filterFn means the column is not filterable, which is exactly what a
    // ColumnDef without one does: nothing is filtered.
    if (!filterFn) return conformanceRows.map((row) => row.id);

    return conformanceRows
      .filter((row) =>
        filterFn(
          // TanStack hands the predicate the row accessor, not the row.
          { getValue: (columnId) => getValueAtKey(row, columnId) },
          testCase.key,
          testCase.value,
        ),
      )
      .map((row) => row.id);
  },
  // No `supports`: a client-side filter that cannot express what the server
  // does is the divergence this module was written to remove.
});

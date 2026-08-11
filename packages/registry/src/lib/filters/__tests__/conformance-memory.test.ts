import { defineFilters } from "../index";
import {
  conformanceRows,
  conformanceSchema,
  runConformance,
} from "../testing/conformance";

/**
 * The in-memory engine against the conformance corpus.
 *
 * This suite is NOT the oracle — the corpus's hand-written `expect` arrays are.
 * `defineFilters(...).apply` is just another engine here, held to the same
 * external standard as the SQL and TanStack ones. That is the point: if the
 * in-memory engine defined the answers, a bug in it would become the spec and
 * every engine would agree on the wrong result.
 */
const filters = defineFilters(conformanceSchema);

runConformance({
  engine: "in-memory (defineFilters().apply)",
  select: (testCase) =>
    filters
      .apply(conformanceRows, { [testCase.key]: testCase.value })
      .map((row) => row.id),
  // No `supports`: the in-memory engine is the substrate the corpus is authored
  // in, so it has no licence to decline anything.
});

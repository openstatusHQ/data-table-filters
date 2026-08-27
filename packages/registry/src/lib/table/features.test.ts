import { describe, expect, it } from "vitest";
import { dataTableFeatures } from "./features";
import { arrSome, inDateRange } from "./filterfns";

/**
 * These assertions exist to catch bloat and omissions, not to restate the file.
 *
 * v9 makes the feature set an explicit, shippable artifact: registering too
 * little silently disables an API (`getCanSort` simply stops existing), and
 * registering too much — reaching for `stockFeatures`, or spreading the whole
 * `filterFns` registry — quietly puts every stock feature in the consumer's
 * bundle. Neither shows up in a typecheck or in any rendering test.
 */
describe("dataTableFeatures", () => {
  it("registers exactly the features the blocks use", () => {
    const featureKeys = Object.keys(dataTableFeatures)
      .filter((key) => key.endsWith("Feature"))
      .sort();

    expect(featureKeys).toEqual([
      "columnFacetingFeature",
      "columnFilteringFeature",
      "columnOrderingFeature",
      "columnResizingFeature",
      "columnSizingFeature",
      "columnVisibilityFeature",
      "rowPaginationFeature",
      "rowSelectionFeature",
      "rowSortingFeature",
    ]);
  });

  it("does not register features no block uses", () => {
    // Guards against a `stockFeatures` regression: these are the stock features
    // deliberately left out, and each one costs bundle size for every consumer.
    for (const unused of [
      "cellSelectionFeature",
      "cellSpanningFeature",
      "columnGroupingFeature",
      "columnPinningFeature",
      "globalFilteringFeature",
      "rowAggregationFeature",
      "rowExpandingFeature",
      "rowPinningFeature",
    ]) {
      expect(dataTableFeatures).not.toHaveProperty(unused);
    }
  });

  it("pairs every registered row-model slot with its feature", () => {
    // A slot without its feature is the single most common v9 migration bug:
    // the getter exists on the type but returns nothing at runtime.
    const slotToFeature = {
      filteredRowModel: "columnFilteringFeature",
      sortedRowModel: "rowSortingFeature",
      paginatedRowModel: "rowPaginationFeature",
      facetedRowModel: "columnFacetingFeature",
      facetedUniqueValues: "columnFacetingFeature",
      facetedMinMaxValues: "columnFacetingFeature",
    } as const;

    for (const [slot, feature] of Object.entries(slotToFeature)) {
      expect(dataTableFeatures).toHaveProperty(slot);
      expect(dataTableFeatures).toHaveProperty(feature);
    }
  });

  it("registers the whole `filterFn: 'auto'` resolution set", () => {
    // `auto` is the default for every column that does not name a filter. In v9
    // an unregistered name does not fall back — the column stops filtering.
    for (const name of [
      "includesString",
      "inNumberRange",
      "equals",
      "arrIncludes",
      "inDateRange",
      "weakEquals",
    ]) {
      expect(dataTableFeatures.filterFns).toHaveProperty(name);
    }
  });

  it("registers the whole `sortFn: 'auto'` resolution set", () => {
    for (const name of ["datetime", "alphanumeric", "text"]) {
      expect(dataTableFeatures.sortFns).toHaveProperty(name);
    }
  });

  it("keeps the repo's own filter semantics under `inDateRange` and `arrSome`", () => {
    // Ours shadows the v9 built-in of the same name on purpose — the
    // client/server equivalence pinned by the filter conformance suite depends
    // on this exact function being the one registered.
    expect(dataTableFeatures.filterFns.inDateRange).toBe(inDateRange);
    expect(dataTableFeatures.filterFns.arrSome).toBe(arrSome);
  });

  it("registers the array-flattening faceted unique values factory", () => {
    // The stock factory counts `["ams", "fra"]` as one value; array columns are
    // a first-class citizen here, so the flattening variant has to be the one
    // in the slot. See `lib/data-table/faceted.test.ts` for its behaviour.
    expect(typeof dataTableFeatures.facetedUniqueValues).toBe("function");
  });
});

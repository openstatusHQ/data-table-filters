import { LEVELS } from "@/constants/levels";
import {
  calculatePercentileRanks,
  calculateSpecificPercentile,
} from "@/lib/request/percentile";
import { bucketChartData } from "@dtf/registry/lib/data-table/chart-data";
import { evaluateIntervalMs } from "@dtf/registry/lib/data-table/interval";
import { defineFilters } from "@dtf/registry/lib/filters";
import type {
  ColumnSchema,
  FacetMetadataSchema,
  TimelineChartSchema,
} from "../schema";
import type { SearchParamsType } from "../search-params";
import { tableSchema } from "../table-schema";

/**
 * The one interpretation of this table's filter semantics, shared with the
 * Drizzle route and the TanStack client.
 *
 * This replaces `filterData` — an 85-line per-key `if` chain that disagreed
 * with the SQL engine on array overlap (it compared only `row[key][0]`) and on
 * case sensitivity (it was case-*sensitive* where `ilike` is not).
 */
export const filters = defineFilters(tableSchema.definition);

/** Slider keys, for the three-pass facet strategy. */
export const sliderKeys = filters.specs
  .filter((spec) => spec.type === "slider")
  .map((spec) => spec.key);

/** Date keys, for the three-pass facet strategy. */
export const dateKeys = filters.specs
  .filter((spec) => spec.type === "timerange")
  .map((spec) => spec.key);

/** Keys that get facet counts — everything filterable except date ranges. */
export const facetKeys = filters.specs
  .filter((spec) => spec.type !== "timerange")
  .map((spec) => spec.key);

export function sortData(data: ColumnSchema[], sort: SearchParamsType["sort"]) {
  if (!sort) return data;
  return data.sort((a, b) => {
    if (sort.desc) {
      // @ts-ignore
      return a?.[sort.id] < b?.[sort.id] ? 1 : -1;
    } else {
      // @ts-ignore
      return a?.[sort.id] > b?.[sort.id] ? 1 : -1;
    }
  });
}

export function percentileData(data: ColumnSchema[]): ColumnSchema[] {
  const percentiles = calculatePercentileRanks(data.map((row) => row.latency));
  return data.map((row, index) => ({
    ...row,
    percentile: percentiles[index],
  }));
}

export function splitData(
  data: ColumnSchema[],
  search: Pick<SearchParamsType, "cursor" | "size" | "direction">,
) {
  let newData: ColumnSchema[] = [];
  const now = new Date();
  // cursor undefined = "now"
  const cursorTime = search.cursor?.getTime() ?? now.getTime();
  const size = search.size ?? 40; // Default page size
  const direction = search.direction ?? "next"; // Default direction

  // TODO: write a helper function for this
  data.forEach((item) => {
    if (direction === "next") {
      if (item.date.getTime() < cursorTime && newData.length < size) {
        newData.push(item);
        // TODO: check how to deal with the cases that there are some items left with the same date
      } else if (
        item.date.getTime() === newData[newData.length - 1]?.date.getTime()
      ) {
        newData.push(item);
      }
    } else if (direction === "prev") {
      if (
        item.date.getTime() > cursorTime &&
        // REMINDER: we need to make sure that we don't get items that are in the future which we do with mockLive data
        item.date.getTime() < now.getTime()
      ) {
        newData.push(item);
      }
    }
  });

  return newData;
}

export function getFacetsFromData(data: ColumnSchema[]) {
  const valuesMap = data.reduce((prev, curr) => {
    Object.entries(curr).forEach(([key, value]) => {
      if (facetKeys.includes(key)) {
        // REMINDER: because regions is an array with a single value we need to convert to string
        // TODO: we should make the region a single string instead of an array?!?
        const _value = Array.isArray(value) ? value.toString() : value;
        const total = prev.get(key)?.get(_value) || 0;
        if (prev.has(key) && _value) {
          prev.get(key)?.set(_value, total + 1);
        } else if (_value) {
          prev.set(key, new Map([[_value, 1]]));
        }
      }
    });
    return prev;
  }, new Map<string, Map<any, number>>());

  const facets = Object.fromEntries(
    Array.from(valuesMap.entries()).map(([key, valueMap]) => {
      let min: number | undefined;
      let max: number | undefined;
      const rows = Array.from(valueMap.entries()).map(([value, total]) => {
        if (typeof value === "number") {
          if (!min) min = value;
          else min = value < min ? value : min;
          if (!max) max = value;
          else max = value > max ? value : max;
        }
        return {
          value,
          total,
        };
      });
      const total = Array.from(valueMap.values()).reduce((a, b) => a + b, 0);
      return [key, { rows, total, min, max }];
    }),
  );

  return facets satisfies Record<string, FacetMetadataSchema>;
}

export function getPercentileFromData(data: ColumnSchema[]) {
  const latencies = data.map((row) => row.latency);

  const p50 = calculateSpecificPercentile(latencies, 50);
  const p75 = calculateSpecificPercentile(latencies, 75);
  const p90 = calculateSpecificPercentile(latencies, 90);
  const p95 = calculateSpecificPercentile(latencies, 95);
  const p99 = calculateSpecificPercentile(latencies, 99);

  return { p50, p75, p90, p95, p99 };
}

export function groupChartData(
  data: ColumnSchema[],
  dates: Date[] | null,
): TimelineChartSchema[] {
  if (data?.length === 0 && !dates) return [];
  // The bucketing lives in the chart block now, shared with the example
  // route; this keeps the demo's signature.
  return bucketChartData(data, {
    timestamp: (row) => row.date,
    series: (row) => row.level,
    keys: LEVELS,
    range: dates,
  }) as TimelineChartSchema[];
}

/** The bucket ladder, on a time-range filter value. `0` when it says nothing. */
export function evaluateInterval(dates: Date[] | null): number {
  if (!dates) return 0;
  if (dates.length < 1 || dates.length > 3) return 0;
  return evaluateIntervalMs(
    (dates[0]?.getTime() ?? NaN) - (dates[1]?.getTime() ?? NaN),
  );
}

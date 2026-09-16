import type {
  FacetMetadataSchema,
  InfiniteQueryResponse,
} from "@dtf/registry/lib/data-table";
import { bucketChartData } from "@dtf/registry/lib/data-table/chart-data";
import { defineFilters } from "@dtf/registry/lib/filters";
import SuperJSON from "superjson";
import { rows } from "../data";
import { searchParamsCache, type SearchParams } from "../schema";
import { LEVELS, tableSchema, type ColumnSchema } from "../table-schema";

export const dynamic = "force-dynamic";

/**
 * The same filter semantics the sidebar, the command palette and the Drizzle
 * handler use, applied to an array. When the rows move to Postgres, replace
 * this file with `createDrizzleHandler` from the drizzle block — the client
 * does not change.
 */
const filters = defineFilters(tableSchema.definition);

const sliderKeys = filters.specs
  .filter((spec) => spec.type === "slider")
  .map((spec) => spec.key);
const dateKeys = filters.specs
  .filter((spec) => spec.type === "timerange")
  .map((spec) => spec.key);
const facetKeys = filters.specs
  .filter((spec) => spec.type !== "timerange" && spec.type !== "slider")
  .map((spec) => spec.key);

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const search = searchParamsCache.parse(Object.fromEntries(url.searchParams));
  const values = search as Record<string, unknown>;

  // Three passes, matching the Drizzle handler: the date range first, then
  // every filter except the sliders, then the sliders. A slider's min and max
  // facet is computed over the second pass, so the range stays visible after
  // the user narrows it.
  const ranged = filters.apply(rows, values, { only: dateKeys });
  const withoutSliders = filters.apply(ranged, values, {
    exclude: [...sliderKeys, ...dateKeys],
  });
  const filtered = filters.apply(withoutSliders, values, { only: sliderKeys });

  const page = pageRows(sortRows(filtered, search.sort), search);

  // Pagination requests send `_meta=false`: the client keeps the meta from the
  // first page, and it cannot change while the filters are fixed.
  const skipMeta = url.searchParams.get("_meta") === "false";
  const facets = skipMeta
    ? {}
    : {
        ...facetsOf(withoutSliders, sliderKeys),
        ...facetsOf(filtered, facetKeys),
      };
  // One point per time bucket with a count per level, over the date filter
  // when one is set and the rows' own span otherwise.
  const chartData = skipMeta
    ? []
    : bucketChartData(filtered, {
        timestamp: (row) => row.date,
        series: (row) => row.level,
        keys: LEVELS,
        range: search.date,
      });

  const response: InfiniteQueryResponse<ColumnSchema[]> = {
    data: page,
    meta: {
      totalRowCount: rows.length,
      filterRowCount: filtered.length,
      chartData,
      facets,
    },
    prevCursor: page.length > 0 ? page[0].date.getTime() : null,
    nextCursor: page.length > 0 ? page[page.length - 1].date.getTime() : null,
  };

  return Response.json(SuperJSON.stringify(response));
}

function compare(left: unknown, right: unknown): number {
  const a = left instanceof Date ? left.getTime() : left;
  const b = right instanceof Date ? right.getTime() : right;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

function sortRows(
  data: ColumnSchema[],
  sort: SearchParams["sort"],
): ColumnSchema[] {
  if (!sort) return data;
  const key = sort.id as keyof ColumnSchema;
  const direction = sort.desc ? -1 : 1;
  return [...data].sort((a, b) => compare(a[key], b[key]) * direction);
}

/**
 * One page, addressed by a timestamp cursor. `next` reads rows older than the
 * cursor; `prev` reads everything newer, which is what a live refresh asks
 * for. Rows sharing the last timestamp travel together so none are skipped.
 */
function pageRows(
  data: ColumnSchema[],
  search: Pick<SearchParams, "cursor" | "size" | "direction">,
): ColumnSchema[] {
  const cursor = search.cursor?.getTime() ?? Date.now();
  const size = search.size ?? 40;

  if (search.direction === "prev") {
    return data.filter((row) => row.date.getTime() > cursor);
  }

  const page: ColumnSchema[] = [];
  for (const row of data) {
    const time = row.date.getTime();
    if (time >= cursor) continue;
    const last = page[page.length - 1];
    if (page.length < size || (last && last.date.getTime() === time)) {
      page.push(row);
    } else {
      break;
    }
  }
  return page;
}

/** Value counts per key, plus min and max for the numeric ones. */
function facetsOf(
  data: ColumnSchema[],
  keys: string[],
): Record<string, FacetMetadataSchema> {
  const facets: Record<string, FacetMetadataSchema> = {};

  for (const key of keys) {
    const counts = new Map<unknown, number>();
    let min: number | undefined;
    let max: number | undefined;

    for (const row of data) {
      const value = row[key as keyof ColumnSchema];
      if (value === null || value === undefined) continue;
      counts.set(value, (counts.get(value) ?? 0) + 1);
      if (typeof value === "number") {
        min = min === undefined ? value : Math.min(min, value);
        max = max === undefined ? value : Math.max(max, value);
      }
    }

    facets[key] = {
      rows: [...counts].map(([value, total]) => ({ value, total })),
      total: data.length,
      min,
      max,
    };
  }

  return facets;
}

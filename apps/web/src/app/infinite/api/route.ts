import { calculateSpecificPercentile } from "@/lib/request/percentile";
import { addDays } from "date-fns";
import { NextRequest } from "next/server";
import SuperJSON from "superjson";
import type { InfiniteQueryResponse, LogsMeta } from "../query-options";
import type { ColumnSchema } from "../schema";
import { searchParamsCache } from "../search-params";
import {
  dateKeys,
  filters,
  getFacetsFromData,
  groupChartData,
  percentileData,
  sliderKeys,
  sortData,
  splitData,
} from "./helpers";
import { mock, mockLive } from "./mock";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  // TODO: we could use a POST request to avoid this
  const _search: Map<string, string> = new Map();
  req.nextUrl.searchParams.forEach((value, key) => _search.set(key, value));

  const search = searchParamsCache.parse(Object.fromEntries(_search));
  const totalData = [...mockLive, ...mock];

  // Filter out null values from date array and handle single date expansion
  const validDates = search.date?.filter((d): d is Date => d !== null);
  // Treat empty array as null (no date filter)
  const _date =
    !validDates || validDates.length === 0
      ? null
      : validDates.length === 1
        ? [validDates[0], addDays(validDates[0], 1)]
        : validDates;

  // Three passes, matching the Drizzle handler exactly: date range, then
  // everything except sliders (the set slider bounds are computed over), then
  // the sliders themselves.
  const values = search as Record<string, unknown>;
  const rangedData = filters.apply(totalData, values, { only: dateKeys });
  const withoutSliderData = filters.apply(rangedData, values, {
    exclude: [...sliderKeys, ...dateKeys],
  });
  const filteredData = filters.apply(withoutSliderData, values, {
    only: sliderKeys,
  });
  // Pagination requests set `_meta=false`: the client already holds the meta
  // payload from the initial page and it cannot change while filters are fixed.
  // Only `meta` is skippable — per-row fields are still needed to render rows.
  const skipMeta = req.nextUrl.searchParams.get("_meta") === "false";

  const chartData = skipMeta ? [] : groupChartData(filteredData, _date); // TODO: rangedData or filterData // REMINDER: avoid sorting the chartData
  const sortedData = sortData(filteredData, search.sort);
  const withoutSliderFacets = skipMeta
    ? {}
    : getFacetsFromData(withoutSliderData);
  const facets = skipMeta ? {} : getFacetsFromData(filteredData);
  // NOT skippable: `percentile` is a per-row field rendered by the row detail
  // sheet, so dropping it makes every scrolled-in row show "N/A".
  const withPercentileData = percentileData(sortedData);
  const data = splitData(withPercentileData, search);

  // Skippable: derived from the whole filtered set, so it is identical on every
  // page. `metadata` is optional on the response, so omit it rather than sending
  // a half-filled object.
  const latencies = skipMeta
    ? []
    : withPercentileData.map(({ latency }) => latency);
  const metadata: LogsMeta | undefined = skipMeta
    ? undefined
    : {
        currentPercentiles: {
          50: calculateSpecificPercentile(latencies, 50),
          75: calculateSpecificPercentile(latencies, 75),
          90: calculateSpecificPercentile(latencies, 90),
          95: calculateSpecificPercentile(latencies, 95),
          99: calculateSpecificPercentile(latencies, 99),
        },
      };

  const nextCursor =
    data.length > 0 ? data[data.length - 1].date.getTime() : null;
  const prevCursor =
    data.length > 0 ? data[0].date.getTime() : new Date().getTime();

  return Response.json(
    SuperJSON.stringify({
      data,
      meta: {
        totalRowCount: totalData.length,
        filterRowCount: filteredData.length,
        chartData,
        // REMINDER: we separate the slider for keeping the min/max facets of the slider fields
        facets: {
          ...withoutSliderFacets,
          ...Object.fromEntries(
            Object.entries(facets).filter(([key]) => !sliderKeys.includes(key)),
          ),
        },
        metadata,
      },
      prevCursor,
      nextCursor,
    } satisfies InfiniteQueryResponse<ColumnSchema[], LogsMeta>),
  );
}

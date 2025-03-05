import { NextRequest } from "next/server";
import { mock, mockLive } from "./mock";
import { searchParamsCache } from "../search-params";
import {
  filterData,
  getFacetsFromData,
  groupChartData,
  percentileData,
  sliderFilterValues,
  sortData,
  splitData,
} from "./helpers";
import { calculateSpecificPercentile } from "@/lib/request/percentile";
import { addDays } from "date-fns";
import type { InfiniteQueryResponse } from "../query-options";
import { ColumnSchema } from "../schema";
import SuperJSON from "superjson";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // TODO: we could use a POST request to avoid this
  const _search: Map<string, string> = new Map();
  req.nextUrl.searchParams.forEach((value, key) => _search.set(key, value));

  const search = searchParamsCache.parse(Object.fromEntries(_search));
  const totalData = [...mockLive, ...mock];

  const _date =
    search.date?.length === 1
      ? [search.date[0], addDays(search.date[0], 1)]
      : search.date;

  // REMINDER: we need to filter out the slider values because they are not part of the search params
  const _rest = Object.fromEntries(
    Object.entries(search).filter(
      ([key]) => !sliderFilterValues.includes(key as any),
    ),
  );

  const rangedData = filterData(totalData, { date: _date });
  const withoutSliderData = filterData(rangedData, { ..._rest, date: null });

  const filteredData = filterData(withoutSliderData, { ...search, date: null });
  const chartData = groupChartData(filteredData, _date); // TODO: rangedData or filterData // REMINDER: avoid sorting the chartData
  const sortedData = sortData(filteredData, search.sort);
  const withoutSliderFacets = getFacetsFromData(withoutSliderData);
  const facets = getFacetsFromData(filteredData);
  const withPercentileData = percentileData(sortedData);
  const data = splitData(withPercentileData, search);

  const latencies = withPercentileData.map(({ latency }) => latency);
  const currentPercentiles = {
    50: calculateSpecificPercentile(latencies, 50),
    75: calculateSpecificPercentile(latencies, 75),
    90: calculateSpecificPercentile(latencies, 90),
    95: calculateSpecificPercentile(latencies, 95),
    99: calculateSpecificPercentile(latencies, 99),
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
            Object.entries(facets).filter(
              ([key]) => !sliderFilterValues.includes(key as any),
            ),
          ),
        },
        metadata: { currentPercentiles },
      },
      prevCursor,
      nextCursor,
    } satisfies InfiniteQueryResponse<ColumnSchema[]>),
  );
}

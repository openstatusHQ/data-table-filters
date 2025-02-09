import { NextRequest } from "next/server";
import { mock } from "./mock";
import { searchParamsCache } from "../search-params";
import {
  filterData,
  getFacetsFromData,
  groupChartData,
  percentileData,
  sortData,
} from "./helpers";
import { calculateSpecificPercentile } from "@/lib/request/percentile";
import { addDays } from "date-fns";

export async function GET(req: NextRequest) {
  // TODO: we could use a POST request to avoid this
  const _search: Map<string, string> = new Map();
  req.nextUrl.searchParams.forEach((value, key) => _search.set(key, value));

  const search = searchParamsCache.parse(Object.fromEntries(_search));

  const totalData = mock;

  const _date =
    search.date?.length === 1
      ? [search.date[0], addDays(search.date[0], 1)]
      : search.date;

  const rangedData = filterData(totalData, { date: _date });
  const filteredData = filterData(rangedData, { ...search, date: null });
  const chartData = groupChartData(filteredData, _date); // TODO: rangedData or filterData // REMINDER: avoid sorting the chartData
  const sortedData = sortData(filteredData, search.sort);
  const facets = getFacetsFromData(filteredData);
  const withPercentileData = percentileData(sortedData);

  const latencies = withPercentileData.map(({ latency }) => latency);

  const currentPercentiles = {
    50: calculateSpecificPercentile(latencies, 50),
    75: calculateSpecificPercentile(latencies, 75),
    90: calculateSpecificPercentile(latencies, 90),
    95: calculateSpecificPercentile(latencies, 95),
    99: calculateSpecificPercentile(latencies, 99),
  };

  return Response.json({
    data: withPercentileData.slice(search.start, search.start + search.size),
    meta: {
      totalRowCount: totalData.length,
      filterRowCount: filteredData.length,
      currentPercentiles,
      chartData,
      facets,
    },
  });
}

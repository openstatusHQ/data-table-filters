import { NextRequest } from "next/server";
import { mock } from "./mock";
import { searchParamsCache } from "../search-params";
import {
  filterData,
  groupGraphData,
  percentileData,
  sortData,
} from "./helpers";
import { calculateSpecificPercentile } from "@/lib/request/percentile";

export async function GET(req: NextRequest) {
  // TODO: we could use a POST request to avoid this
  const _search: Map<string, string> = new Map();
  req.nextUrl.searchParams.forEach((value, key) => _search.set(key, value));

  const search = searchParamsCache.parse(Object.fromEntries(_search));

  const totalData = mock;

  const rangedData = filterData(totalData, { date: search.date });
  const filteredData = filterData(rangedData, { ...search, date: null });
  const sortedData = sortData(filteredData, search.sort);
  const graphedData = groupGraphData(sortedData, search.date); // TODO: rangedData or filterData
  const withPercentileData = percentileData(sortedData);

  // FIXME: this is fugly
  const totalFilters = totalData.reduce((prev, curr) => {
    for (const key in curr) {
      const value = curr[key as keyof typeof curr];
      const prevValue = prev[key as keyof typeof prev] || [];
      if (Array.isArray(value)) {
        prev[key as keyof typeof prev] = [
          // @ts-ignore
          ...new Set([...prevValue, ...value]),
        ];
      } else {
        // @ts-ignore
        prev[key as keyof typeof prev] = [...new Set([...prevValue, value])];
      }
    }
    return prev;
  }, {} as Record<string, (number | string | boolean | Date)[]>);

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
      totalFilters,
      currentPercentiles,
      graphData: graphedData,
    },
  });
}

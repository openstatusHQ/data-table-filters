import { differenceInMinutes } from "date-fns";
import type { NextRequest } from "next/server";
import SuperJSON from "superjson";
import { InfiniteQueryResponse } from "../query-options";
import { searchParamsCache } from "../search-params";
import { BaseChartType, ColumnType, FacetMetadataType } from "../types";

type _TemporalFacetsType = {
  facet: string;
  // REMINDER: some values need to be parsed as int
  value: string;
  count: number;
};

const PAGE_SIZE = 100;
const VERCEL_EDGE_PING_URL = "https://light.openstatus.dev";

export async function GET(req: NextRequest) {
  // TODO: we could use a POST request to avoid this
  const _search: Map<string, string> = new Map();
  req.nextUrl.searchParams.forEach((value, key) => _search.set(key, value));

  const search = searchParamsCache.parse(Object.fromEntries(_search));

  const searchParams = new URLSearchParams();
  searchParams.set("pageSize", PAGE_SIZE.toString());

  // REMINDER: we need to map the different filters
  if (search.cursor) {
    searchParams.set("timestampEnd", search.cursor.getTime().toString());
  }
  if (search.timestamp?.length) {
    searchParams.set(
      "timestampStart",
      search.timestamp[0].getTime().toString(),
    );
    searchParams.set(
      "timestampEnd",
      search.timestamp[search.timestamp.length - 1].getTime().toString(),
    );
  }

  if (search.level) {
    searchParams.set("level", search.level.join(","));
  }
  if (search.latency?.length) {
    searchParams.set("latencyStart", search.latency[0].toString());
    searchParams.set(
      "latencyEnd",
      search.latency[search.latency.length - 1].toString(),
    );
  }
  if (search.status) {
    searchParams.set("statuses", search.status.join(","));
  }
  if (search.method) {
    searchParams.set("methods", search.method.join(","));
  }
  if (search.region) {
    searchParams.set("regions", search.region.join(","));
  }

  const facetsParams = new URLSearchParams();
  if (search.timestamp) {
    facetsParams.set(
      "timestampStart",
      search.timestamp[0].getTime().toString(),
    );
    facetsParams.set(
      "timestampEnd",
      search.timestamp[search.timestamp.length - 1].getTime().toString(),
    );
  } else {
    facetsParams.set("timestampStart", "0");
  }

  // REMIDNER: we are not filtering by search params
  const statsParams = new URLSearchParams();
  if (search.timestamp) {
    statsParams.set("timestampStart", search.timestamp[0].getTime().toString());
    statsParams.set(
      "timestampEnd",
      search.timestamp[search.timestamp.length - 1].getTime().toString(),
    );
    const interval = evaluateInterval(search.timestamp);
    if (interval) {
      statsParams.set("interval", interval.toString());
    }
  }

  const [dataRes, chartRes, facetsRes] = await Promise.all([
    fetch(`${VERCEL_EDGE_PING_URL}/api/get?${searchParams.toString()}`),
    // TODO: we are missing filter in both, the stats and the facets
    fetch(`${VERCEL_EDGE_PING_URL}/api/stats?${statsParams.toString()}`),
    fetch(`${VERCEL_EDGE_PING_URL}/api/facets?${facetsParams.toString()}`),
  ]);

  const { data, rows_before_limit_at_least: filterRowCount } =
    (await dataRes.json()) as {
      data: ColumnType[];
      rows_before_limit_at_least: number;
      rows: number;
      // ...
    };
  const { data: chart } = (await chartRes.json()) as {
    data: BaseChartType[];
  };
  const { data: _facets } = (await facetsRes.json()) as {
    data: _TemporalFacetsType[];
  };

  const facets = _facets.reduce(
    (acc, curr) => {
      const facet = acc[curr.facet] ?? {
        rows: [],
        total: 0,
      };
      if (curr.facet === "status") {
        facet.rows.push({
          value: parseInt(curr.value),
          total: curr.count,
        });
        // REMINDER: fugly but works and not many status codes so no performance hit
        facet.rows.sort((a, b) => a.value - b.value);
        facet.total += curr.count;
      } else if (curr.facet === "latency") {
        facet.rows.push({
          value: parseInt(curr.value),
          total: curr.count,
        });
        facet.total += curr.count;
        facet.min = Math.min(facet.min ?? 0, parseInt(curr.value));
        facet.max = Math.max(facet.max ?? 0, parseInt(curr.value));
      } else {
        facet.rows.push({
          value: curr.value,
          total: curr.count,
        });
        facet.total += curr.count;
      }

      acc[curr.facet] = facet;
      return acc;
    },
    {} as Record<string, FacetMetadataType>,
  );

  const lastTimestamp = data[data.length - 1]?.timestamp;

  return Response.json(
    SuperJSON.stringify({
      data,
      prevCursor: null,
      nextCursor:
        lastTimestamp && filterRowCount > PAGE_SIZE ? lastTimestamp - 1 : null,
      meta: {
        chart,
        facets,
        totalRowCount: facets["level"]?.total ?? 0,
        filterRowCount,
      },
    } satisfies InfiniteQueryResponse<ColumnType[]>),
  );
}

function evaluateInterval(dates: Date[] | null): number | null {
  if (!dates) return null;
  if (dates.length < 1 || dates.length > 3) return null;

  const timeDiffInMinutes = Math.abs(differenceInMinutes(dates[0], dates[1]));

  if (timeDiffInMinutes < 60) return 1;
  // 2h
  if (timeDiffInMinutes < 120) return 5;
  // 4h
  if (timeDiffInMinutes < 240) return 10;
  // 8h
  if (timeDiffInMinutes < 480) return 30;
  // 12h
  if (timeDiffInMinutes < 1440) return 60;
  // 24h
  if (timeDiffInMinutes < 2880) return 60;
  // 48h
  if (timeDiffInMinutes < 5760) return 120;
  // 2d
  if (timeDiffInMinutes < 11520) return 240;
  // 4d
  if (timeDiffInMinutes < 23040) return 480;
  // 8d
  if (timeDiffInMinutes < 46080) return 1440;
  // 16d
  if (timeDiffInMinutes < 92160) return 1440;
  // 32d
  if (timeDiffInMinutes < 184320) return 2880;
  // 64d
  if (timeDiffInMinutes < 368640) return 5760;
  // 128d
  if (timeDiffInMinutes < 737280) return 11520;
  // 256d
  if (timeDiffInMinutes < 1474560) return 23040;
  // 512d
  return 46080;
}

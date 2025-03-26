// TODO: use nuqs to get data
import SuperJSON from "superjson";
import { InfiniteQueryResponse } from "../query-options";
import { ColumnType } from "../types";
import chart from "./chart.json";
import data from "./data.json";

const VERCEL_EDGE_PING_URL = "https://light.openstatus.dev";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const pageSize = searchParams.get("pageSize") ?? "100";
  const pageIndex = searchParams.get("pageIndex") ?? "0";
  // const res = await fetch(
  //   `${VERCEL_EDGE_PING_URL}/api/get?pageSize=${pageSize}&pageIndex=${pageIndex}`,
  // );
  // const data = await res.json();

  return Response.json(
    SuperJSON.stringify({
      // FIXME: type
      data: data as ColumnType[],
      prevCursor: null,
      nextCursor: null,
      meta: {
        chart,
        // FIXME: add facets
        facets: {},
        totalRowCount: data.length,
        filterRowCount: 0,
      },
    } satisfies InfiniteQueryResponse<ColumnType[]>),
  );
}

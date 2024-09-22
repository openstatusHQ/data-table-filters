import { NextRequest } from "next/server";
import { mock } from "./mock";
import { parseAsSort } from "@/_data-table/search-params";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const size = searchParams.get("size");
  const start = searchParams.get("start");
  const _sort = searchParams.get("sort");
  // REMINDER: keep the filter on client side ?
  const filter = searchParams.get("filter");

  const data = [...mock];

  const sort = _sort ? parseAsSort.parse(_sort) : null;

  if (sort) {
    data.sort((a, b) => {
      if (sort.desc) {
        // @ts-ignore
        return a?.[sort.id] < b[sort.id] ? 1 : -1;
      } else {
        // @ts-ignore
        return a[sort.id] > b[sort.id] ? 1 : -1;
      }
    });
  }

  await new Promise((resolve) => setTimeout(resolve, 1000));

  return Response.json({
    data: data.slice(Number(start), Number(start) + Number(size)),
    meta: {
      totalRowCount: data.length,
    },
  });
}

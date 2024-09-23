import { NextRequest } from "next/server";
import { mock } from "./mock";
import { searchParamsCache } from "@/_data-table/search-params";

export async function GET(req: NextRequest) {
  const _search: Map<string, string> = new Map();

  req.nextUrl.searchParams.forEach((value, key) => _search.set(key, value));

  const search = searchParamsCache.parse(Object.fromEntries(_search));

  const { size, start, sort, ...filters } = search;
  const data = [...mock];

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

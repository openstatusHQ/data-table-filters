import { NextRequest } from "next/server";
import { mock } from "./mock";
import { searchParamsCache } from "../search-params";

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

  const slicedData = data.slice(Number(start), Number(start) + Number(size));

  // FIXME: this is fugly
  const slicedFilters = slicedData.reduce((prev, curr) => {
    for (const key in curr) {
      const value = curr[key as keyof typeof curr];
      const prevValue = prev[key as keyof typeof prev] || [];
      if (Array.isArray(value)) {
        // @ts-ignore
        prev[key as keyof typeof prev] = [...new Set([...prevValue, ...value])];
      } else {
        // @ts-ignore
        prev[key as keyof typeof prev] = [...new Set([...prevValue, value])];
      }
    }
    return prev;
  }, {} as Record<string, (number | string | boolean | Date)[]>);

  return Response.json({
    data: slicedData,
    meta: {
      totalRowCount: data.length,
      currentFilters: slicedFilters,
    },
  });
}

import { NextRequest } from "next/server";
import { mock } from "./mock";
import { ColumnSort } from "@tanstack/react-table";
import { ColumnSchema } from "@/_data-table/schema";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const size = searchParams.get("size");
  const start = searchParams.get("start");
  const sorting = searchParams.get("sorting");
  // REMINDER: keep the filter on client side
  const filter = searchParams.get("filter");

  const data = [...mock];

  if (sorting?.length) {
    const sort = sorting as unknown as ColumnSort;
    const { id, desc } = sort as { id: keyof ColumnSchema; desc: boolean };

    data.sort((a, b) => {
      if (desc) {
        // @ts-ignore
        return a[id] > b[id] ? 1 : -1;
      } else {
        // @ts-ignore
        return a?.[id] < b[id] ? 1 : -1;
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

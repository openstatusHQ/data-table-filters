import type { InfiniteQueryMeta } from "@/app/infinite/query-options";
import { NextResponse } from "next/server";
import { getBuilderData } from "../cache";
import {
  filterGenericData,
  getGenericFacets,
  schemaJsonToDefinition,
  sortGenericData,
  splitGenericData,
} from "./helpers";

type BuilderDataRequest = {
  dataId: string;
  filters: Record<string, unknown>;
  sort: { id: string; desc: boolean } | null;
  offset: number;
  size: number;
};

export type BuilderDataResponse = {
  data: Record<string, unknown>[];
  meta: InfiniteQueryMeta;
  nextCursor: number | null;
};

/**
 * POST /api/builder/data
 *
 * Paginated data query endpoint for the builder.
 * Accepts dataId, filters, sort, offset, and size.
 * Returns filtered, sorted, paginated data with facets.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as BuilderDataRequest;
    const { dataId, filters, sort, offset, size } = body;

    const entry = getBuilderData(dataId);
    if (!entry) {
      return NextResponse.json({ error: "Dataset not found" }, { status: 404 });
    }

    const { data: allData, schemaJson } = entry;
    const schema = schemaJsonToDefinition(schemaJson);

    // Apply filtering
    const filteredData = filterGenericData(allData, filters ?? {}, schema);

    // Row counts from filtered data, min/max from full dataset
    const facets = getGenericFacets(filteredData, allData, schema);

    // Apply sorting
    const sortedData = sortGenericData(filteredData, sort ?? null);

    // Apply pagination
    const pageData = splitGenericData(sortedData, offset ?? 0, size ?? 40);

    const totalFetched = (offset ?? 0) + pageData.length;
    const nextCursor = totalFetched < filteredData.length ? totalFetched : null;

    const response: BuilderDataResponse = {
      data: pageData,
      meta: {
        totalRowCount: allData.length,
        filterRowCount: filteredData.length,
        chartData: [],
        facets,
      },
      nextCursor,
    };

    return NextResponse.json(response);
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }
}

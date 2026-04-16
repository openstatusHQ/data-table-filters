import {
  createDataTableQueryOptions,
  type InfiniteQueryMeta,
  type InfiniteQueryResponse,
} from "@dtf/registry/lib/data-table";
import type { Percentile } from "@/lib/request/percentile";
import type { ColumnSchema } from "./schema";
import { searchParamsSerializer, type SearchParamsType } from "./search-params";

export type LogsMeta = {
  currentPercentiles: Record<Percentile, number>;
};

// Re-export shared types for backward compat
export type { InfiniteQueryMeta, InfiniteQueryResponse };

const _dataOptions = createDataTableQueryOptions<ColumnSchema[], LogsMeta>({
  queryKeyPrefix: "data-table",
  apiEndpoint: "/infinite/api",
  searchParamsSerializer: searchParamsSerializer as (
    search: Record<string, unknown>,
  ) => string,
});

// Typed wrapper so callers get SearchParamsType instead of Record<string, unknown>
export const dataOptions = (search: SearchParamsType) =>
  _dataOptions(search as unknown as Record<string, unknown>);

import { createDataTableQueryOptions } from "@dtf/registry/lib/data-table";
import { searchParamsSerializer, type SearchParams } from "./schema";
import type { ColumnSchema } from "./table-schema";

const options = createDataTableQueryOptions<
  ColumnSchema[],
  Record<string, unknown>
>({
  queryKeyPrefix: "example",
  apiEndpoint: "/example/api",
  searchParamsSerializer: searchParamsSerializer as (
    search: Record<string, unknown>,
  ) => string,
  // The route honours `_meta=false`; the client reads meta via `getMetaPage`.
  skipMetaOnPagination: true,
});

export const dataOptions = (search: SearchParams) =>
  options(search as unknown as Record<string, unknown>);

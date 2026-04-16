import type { FacetMetadataSchema } from "@/lib/data-table/types";
import type { InferSchemaType, SchemaDefinition } from "@/lib/store/schema";

export interface GetDataOptions<T extends SchemaDefinition> {
  filters: Partial<InferSchemaType<T>>;
}

export interface GetDataResult<R = Record<string, unknown>> {
  rows: R[];
  total: number;
  facets?: Record<string, FacetMetadataSchema>;
}

export interface TableMCPConfig<
  T extends SchemaDefinition,
  R = Record<string, unknown>,
> {
  schema: T;
  getData: (options: GetDataOptions<T>) => Promise<GetDataResult<R>>;
  description: string;
  name?: string;
}

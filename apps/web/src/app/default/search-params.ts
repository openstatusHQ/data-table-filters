// Note: import from nuqs adapter server utilities
import {
  createNuqsSearchParams,
  type inferParserType,
} from "@dtf/registry/lib/store/adapters/nuqs/server";
import { filterSchema } from "./schema";

// Create search params utilities from BYOS schema (single source of truth)
export const { searchParamsParser, searchParamsCache, searchParamsSerializer } =
  createNuqsSearchParams(filterSchema.definition);

export type SearchParamsType = inferParserType<typeof searchParamsParser>;

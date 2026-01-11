// Note: import from nuqs adapter server utilities
import {
  createNuqsSearchParams,
  type inferParserType,
} from "@/lib/store/adapters/nuqs/server";
import { filterSchema } from "./schema";

// Create search params utilities from BYOS schema (single source of truth)
// All fields including pagination are now defined in the schema
export const { searchParamsParser, searchParamsCache, searchParamsSerializer } =
  createNuqsSearchParams(filterSchema.definition);

export type SearchParamsType = inferParserType<typeof searchParamsParser>;

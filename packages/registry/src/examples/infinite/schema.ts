import {
  createNuqsSearchParams,
  type inferParserType,
} from "@dtf/registry/lib/store/adapters/nuqs/server";
import { field } from "@dtf/registry/lib/store/schema";
import { generateFilterSchema } from "@dtf/registry/lib/table-schema";
import { tableSchema } from "./table-schema";

const DIRECTIONS = ["prev", "next"] as const;

/**
 * Everything that lives in the URL: one filter field per filterable column,
 * generated from the table schema, plus the state that is not a filter —
 * the sort, the selected row, and the cursor pagination.
 */
export const filterSchema = generateFilterSchema(tableSchema.definition, {
  sort: field.sort(),
  uuid: field.string(),
  size: field.number().default(40),
  direction: field.stringLiteral(DIRECTIONS).default("next"),
  cursor: field.timestamp(),
});

export type FilterState = typeof filterSchema._type;

export const { searchParamsCache, searchParamsSerializer, searchParamsParser } =
  createNuqsSearchParams(filterSchema.definition);

export type SearchParams = inferParserType<typeof searchParamsParser>;

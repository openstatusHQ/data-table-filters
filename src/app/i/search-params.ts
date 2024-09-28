import {
  createParser,
  createSearchParamsCache,
  createSerializer,
  parseAsArrayOf,
  parseAsBoolean,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  parseAsTimestamp,
  type inferParserType,
} from "nuqs/server";
// Note: import from 'nuqs/server' to avoid the "use client" directive
import {
  ARRAY_DELIMITER,
  METHODS,
  RANGE_DELIMITER,
  REGIONS,
  SLIDER_DELIMITER,
} from "./schema";

export const parseAsSort = createParser({
  parse(queryValue) {
    const [id, desc] = queryValue.split(".");
    if (!id && !desc) return null;
    return { id, desc: desc === "desc" };
  },
  serialize(value) {
    return `${value.id}.${value.desc ? "desc" : "asc"}`;
  },
});

export const searchParamsParser = {
  // CUSTOM FILTERS
  success: parseAsArrayOf(parseAsBoolean, ARRAY_DELIMITER),
  latency: parseAsArrayOf(parseAsInteger, SLIDER_DELIMITER),
  status: parseAsArrayOf(parseAsInteger, SLIDER_DELIMITER),
  regions: parseAsArrayOf(parseAsStringLiteral(REGIONS), ARRAY_DELIMITER),
  method: parseAsArrayOf(parseAsStringLiteral(METHODS), ARRAY_DELIMITER),
  host: parseAsString,
  pathname: parseAsString,
  date: parseAsArrayOf(parseAsTimestamp, RANGE_DELIMITER),
  // REQUIRED FOR SORTING & PAGINATION
  sort: parseAsSort,
  size: parseAsInteger.withDefault(30),
  start: parseAsInteger.withDefault(0),
  // REQUIRED FOR SELECTION
  uuid: parseAsString,
};

export const searchParamsCache = createSearchParamsCache(searchParamsParser);

export const searchParamsSerializer = createSerializer(searchParamsParser);

export type SearchParamsType = inferParserType<typeof searchParamsParser>;

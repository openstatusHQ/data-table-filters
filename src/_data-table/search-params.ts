import {
  createSearchParamsCache,
  parseAsArrayOf,
  parseAsBoolean,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  parseAsTimestamp,
} from "nuqs/server";
// Note: import from 'nuqs/server' to avoid the "use client" directive
import {
  ARRAY_DELIMITER,
  RANGE_DELIMITER,
  REGIONS,
  SLIDER_DELIMITER,
  TAGS,
} from "./schema";

export const searchParamsParser = {
  url: parseAsString,
  p95: parseAsArrayOf(parseAsInteger, SLIDER_DELIMITER),
  public: parseAsArrayOf(parseAsBoolean, ARRAY_DELIMITER),
  active: parseAsArrayOf(parseAsBoolean, ARRAY_DELIMITER),
  regions: parseAsArrayOf(parseAsStringLiteral(REGIONS), ARRAY_DELIMITER),
  tags: parseAsArrayOf(parseAsStringLiteral(TAGS), ARRAY_DELIMITER),
  date: parseAsArrayOf(parseAsTimestamp, RANGE_DELIMITER),
};

export const searchParamsCache = createSearchParamsCache(searchParamsParser);

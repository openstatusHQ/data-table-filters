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
  RANGE_DELIMITER,
  SLIDER_DELIMITER,
  SORT_DELIMITER,
} from "@/lib/delimiters";
import { REGIONS } from "@/constants/region";
import { METHODS } from "@/constants/method";
import { LEVELS } from "@/constants/levels";

// https://logs.run/i?sort=latency.desc

export const parseAsSort = createParser({
  parse(queryValue) {
    const [id, desc] = queryValue.split(SORT_DELIMITER);
    if (!id && !desc) return null;
    return { id, desc: desc === "desc" };
  },
  serialize(value) {
    return `${value.id}.${value.desc ? "desc" : "asc"}`;
  },
});

export const searchParamsParser = {
  // CUSTOM FILTERS
  level: parseAsArrayOf(parseAsStringLiteral(LEVELS), ARRAY_DELIMITER),
  latency: parseAsArrayOf(parseAsInteger, SLIDER_DELIMITER),
  "timing.dns": parseAsArrayOf(parseAsInteger, SLIDER_DELIMITER),
  "timing.connection": parseAsArrayOf(parseAsInteger, SLIDER_DELIMITER),
  "timing.tls": parseAsArrayOf(parseAsInteger, SLIDER_DELIMITER),
  "timing.ttfb": parseAsArrayOf(parseAsInteger, SLIDER_DELIMITER),
  "timing.transfer": parseAsArrayOf(parseAsInteger, SLIDER_DELIMITER),
  status: parseAsArrayOf(parseAsInteger, SLIDER_DELIMITER),
  regions: parseAsArrayOf(parseAsStringLiteral(REGIONS), ARRAY_DELIMITER),
  method: parseAsArrayOf(parseAsStringLiteral(METHODS), ARRAY_DELIMITER),
  host: parseAsString,
  pathname: parseAsString,
  date: parseAsArrayOf(parseAsTimestamp, RANGE_DELIMITER),
  // REQUIRED FOR SORTING & PAGINATION
  sort: parseAsSort,
  size: parseAsInteger.withDefault(40),
  start: parseAsInteger.withDefault(0),
  // REQUIRED FOR INFINITE SCROLLING (Live Mode and Load More)
  direction: parseAsStringLiteral(["prev", "next"]).withDefault("next"),
  cursor: parseAsTimestamp.withDefault(new Date()),
  live: parseAsBoolean.withDefault(false),
  // REQUIRED FOR SELECTION
  uuid: parseAsString,
};

export const searchParamsCache = createSearchParamsCache(searchParamsParser);

export const searchParamsSerializer = createSerializer(searchParamsParser);

export type SearchParamsType = inferParserType<typeof searchParamsParser>;

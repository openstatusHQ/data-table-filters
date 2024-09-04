import {
  createParser,
  createSearchParamsCache,
  parseAsArrayOf,
  parseAsBoolean,
  parseAsInteger,
  parseAsJson,
  parseAsString,
  parseAsStringLiteral,
  parseAsTimestamp,
} from "nuqs/server";
import {
  ARRAY_DELIMITER,
  RANGE_DELIMITER,
  REGIONS,
  SLIDER_DELIMITER,
  TAGS,
} from "./schema";
import { z } from "zod";
// Note: import from 'nuqs/server' to avoid the "use client" directive

const zodSchema = z.object({
  foo: z.string(),
  bar: z.number(),
});

const parseAsStarRating = createParser({
  parse(queryValue) {
    const inBetween = queryValue.split("★");
    const isValid = inBetween.length > 1 && inBetween.every((s) => s === "");
    if (!isValid) return null;
    const numStars = inBetween.length - 1;
    return Math.min(5, numStars);
  },
  serialize(value) {
    return Array.from({ length: value }, () => "★").join("");
  },
});

export const test = parseAsJson(zodSchema.parse);

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

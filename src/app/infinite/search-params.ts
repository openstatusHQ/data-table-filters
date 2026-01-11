// Note: import from 'nuqs/server' to avoid the "use client" directive
import { schemaToNuqsParsers } from "@/lib/store/adapters/nuqs/parser-bridge";
import {
  createSearchParamsCache,
  createSerializer,
  parseAsBoolean,
  parseAsInteger,
  parseAsStringLiteral,
  parseAsTimestamp,
  type inferParserType,
} from "nuqs/server";
import { filterSchema } from "./schema";

// Generate nuqs parsers from BYOS schema (single source of truth)
const filterParsers = schemaToNuqsParsers(filterSchema.definition);

export const searchParamsParser = {
  // Filter fields - generated from BYOS schema
  ...filterParsers,
  // Pagination fields (not part of BYOS filter schema)
  size: parseAsInteger.withDefault(40),
  start: parseAsInteger.withDefault(0),
  // Infinite scrolling (Live Mode and Load More)
  direction: parseAsStringLiteral(["prev", "next"]).withDefault("next"),
  cursor: parseAsTimestamp, // undefined = "now" (handled in query-options)
  live: parseAsBoolean.withDefault(false),
};

export const searchParamsCache = createSearchParamsCache(searchParamsParser);

export const searchParamsSerializer = createSerializer(searchParamsParser);

export type SearchParamsType = inferParserType<typeof searchParamsParser>;

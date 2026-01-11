// Note: import from 'nuqs/server' to avoid the "use client" directive
import { schemaToNuqsParsers } from "@/lib/store/adapters/nuqs/parser-bridge";
import {
  createSearchParamsCache,
  createSerializer,
  parseAsStringLiteral,
  parseAsTimestamp,
  type inferParserType,
} from "nuqs/server";
import { filterSchema } from "./schema";

// Generate nuqs parsers from BYOS schema (single source of truth)
// Type is automatically inferred from schema definition
const filterParsers = schemaToNuqsParsers(filterSchema.definition);

export const searchParamsParser = {
  // Filter fields - generated from BYOS schema
  ...filterParsers,
  // Infinite scrolling (pagination)
  direction: parseAsStringLiteral(["prev", "next"]).withDefault("next"),
  cursor: parseAsTimestamp.withDefault(new Date()),
};

export const searchParamsCache = createSearchParamsCache(searchParamsParser);

export const searchParamsSerializer = createSerializer(searchParamsParser);

export type SearchParamsType = inferParserType<typeof searchParamsParser>;

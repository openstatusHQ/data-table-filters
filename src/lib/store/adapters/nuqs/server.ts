/**
 * nuqs Server Utilities for BYOS
 *
 * Server-side utilities for creating search params cache and serializers
 * from BYOS schema definitions. Import this from server components or API routes.
 *
 * @example
 * ```typescript
 * // In your schema file (e.g., search-params.ts)
 * import { createNuqsSearchParams } from '@/lib/store/adapters/nuqs/server';
 * import { filterSchema } from './schema';
 *
 * // Create search params utilities from schema
 * export const {
 *   searchParamsParser,
 *   searchParamsCache,
 *   searchParamsSerializer,
 * } = createNuqsSearchParams(filterSchema.definition, {
 *   // Add extra parsers for pagination, etc.
 *   extraParsers: {
 *     size: parseAsInteger.withDefault(40),
 *     cursor: parseAsTimestamp,
 *   },
 * });
 * ```
 */

import {
  createSearchParamsCache,
  createSerializer,
  type ParserBuilder,
} from "nuqs/server";
import type { SchemaDefinition } from "../../schema/types";
import { schemaToNuqsParsers, type SchemaToNuqsParsers } from "./parser-bridge";

export type { SchemaToNuqsParsers } from "./parser-bridge";

/**
 * Options for creating nuqs search params utilities
 */
export interface CreateNuqsSearchParamsOptions<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TExtra extends Record<string, ParserBuilder<any>> = {},
> {
  /**
   * Additional parsers to include (e.g., pagination params)
   */
  extraParsers?: TExtra;
}

/**
 * Result of createNuqsSearchParams
 */
export interface NuqsSearchParamsResult<
  TSchema extends SchemaDefinition,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TExtra extends Record<string, ParserBuilder<any>> = {},
> {
  /**
   * Combined parser object for useQueryStates
   */
  searchParamsParser: SchemaToNuqsParsers<TSchema> & TExtra;

  /**
   * Search params cache for server-side parsing
   */
  searchParamsCache: ReturnType<
    typeof createSearchParamsCache<SchemaToNuqsParsers<TSchema> & TExtra>
  >;

  /**
   * Serializer for converting state to URL string
   */
  searchParamsSerializer: ReturnType<
    typeof createSerializer<SchemaToNuqsParsers<TSchema> & TExtra>
  >;
}

/**
 * Create nuqs search params utilities from a BYOS schema
 *
 * This creates searchParamsParser, searchParamsCache, and searchParamsSerializer
 * from a schema definition, with optional extra parsers for pagination etc.
 *
 * @example
 * ```typescript
 * import { createNuqsSearchParams } from '@/lib/store/adapters/nuqs/server';
 * import { parseAsInteger, parseAsTimestamp } from 'nuqs/server';
 *
 * export const {
 *   searchParamsParser,
 *   searchParamsCache,
 *   searchParamsSerializer,
 * } = createNuqsSearchParams(filterSchema.definition, {
 *   extraParsers: {
 *     size: parseAsInteger.withDefault(40),
 *     start: parseAsInteger.withDefault(0),
 *     cursor: parseAsTimestamp,
 *   },
 * });
 * ```
 */
export function createNuqsSearchParams<
  TSchema extends SchemaDefinition,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TExtra extends Record<string, ParserBuilder<any>> = {},
>(
  schema: TSchema,
  options: CreateNuqsSearchParamsOptions<TExtra> = {},
): NuqsSearchParamsResult<TSchema, TExtra> {
  const { extraParsers = {} as TExtra } = options;

  // Generate parsers from schema
  const schemaParsers = schemaToNuqsParsers(schema);

  // Combine with extra parsers
  const searchParamsParser = {
    ...schemaParsers,
    ...extraParsers,
  } as SchemaToNuqsParsers<TSchema> & TExtra;

  // Create cache and serializer
  const searchParamsCache = createSearchParamsCache(searchParamsParser);
  const searchParamsSerializer = createSerializer(searchParamsParser);

  return {
    searchParamsParser,
    searchParamsCache,
    searchParamsSerializer,
  };
}

// Re-export commonly used nuqs parsers for convenience
export {
  parseAsArrayOf,
  parseAsBoolean,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  parseAsTimestamp,
  createParser,
  type ParserBuilder,
  type inferParserType,
} from "nuqs/server";

// Re-export schema parser utilities
export { schemaToNuqsParsers, createSchemaSerializer } from "./parser-bridge";

import {
  ARRAY_DELIMITER,
  RANGE_DELIMITER,
  SLIDER_DELIMITER,
} from "@/lib/delimiters";
import { createSchema, field } from "@/lib/store/schema";
import type {
  FieldBuilder,
  Schema,
  SchemaDefinition,
} from "@/lib/store/schema";
import type { ColBuilder, TableSchemaDefinition } from "../types";

/**
 * Extract keys from a TableSchemaDefinition where the column is filterable.
 * A column is filterable when its filter type `F` is not `never`.
 * Uses `[F] extends [never]` to avoid distribution issues with `any`.
 */
type FilterableKeys<T extends TableSchemaDefinition> = {
  [K in keyof T]: T[K] extends ColBuilder<infer _T, infer F>
    ? [F] extends [never]
      ? never
      : K
    : never;
}[keyof T];

/** The generated filter definition — preserves the filterable keys from `T`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GeneratedFilterDef<T extends TableSchemaDefinition> = {
  [K in FilterableKeys<T>]: FieldBuilder<any>;
};

function buildFilterDefinition(
  schema: TableSchemaDefinition,
): SchemaDefinition {
  const definition: SchemaDefinition = {};

  for (const [key, builder] of Object.entries(schema)) {
    const config = builder._config;
    if (!config.filter) continue;

    const { kind, filter, enumValues, arrayItem } = config;

    switch (filter.type) {
      case "input": {
        if (kind === "string") {
          definition[key] = field.string();
        } else if (kind === "number") {
          definition[key] = field.number();
        }
        break;
      }
      case "checkbox": {
        if (kind === "enum" && enumValues) {
          definition[key] = field.array(
            field.stringLiteral(enumValues as readonly string[]),
          );
        } else if (kind === "number") {
          definition[key] = field
            .array(field.number())
            .delimiter(ARRAY_DELIMITER);
        } else if (kind === "boolean") {
          definition[key] = field
            .array(field.boolean())
            .delimiter(ARRAY_DELIMITER);
        } else if (
          kind === "array" &&
          arrayItem?.kind === "enum" &&
          arrayItem.enumValues
        ) {
          definition[key] = field.array(
            field.stringLiteral(arrayItem.enumValues as readonly string[]),
          );
        }
        break;
      }
      case "slider": {
        definition[key] = field
          .array(field.number())
          .delimiter(SLIDER_DELIMITER);
        break;
      }
      case "timerange": {
        definition[key] = field
          .array(field.timestamp())
          .delimiter(RANGE_DELIMITER);
        break;
      }
    }
  }

  return definition;
}

/**
 * Generate a BYOS filter schema from a table schema definition.
 *
 * Each filterable column maps to the appropriate field.* builder:
 * - col.string()  + input    → field.string()
 * - col.number()  + input    → field.number()
 * - col.number()  + slider   → field.array(field.number()).delimiter(SLIDER_DELIMITER)
 * - col.number()  + checkbox → field.array(field.number()).delimiter(ARRAY_DELIMITER)
 * - col.boolean() + checkbox → field.array(field.boolean()).delimiter(ARRAY_DELIMITER)
 * - col.timestamp()+ timerange→ field.array(field.timestamp()).delimiter(RANGE_DELIMITER)
 * - col.enum(v)   + checkbox → field.array(field.stringLiteral(v))
 * - col.array(col.enum(v)) + checkbox → field.array(field.stringLiteral(v))
 *
 * Non-filterable fields are excluded. Pass `extraFields` for pagination,
 * sorting, and other non-filter state.
 *
 * @example
 * ```ts
 * // Without extra fields (filter fields only)
 * const filterSchema = generateFilterSchema(tableSchema.definition);
 *
 * // With extra fields (recommended)
 * const filterSchema = generateFilterSchema(tableSchema.definition, {
 *   sort: field.sort(),
 *   uuid: field.string(),
 *   live: field.boolean().default(false),
 *   size: field.number().default(40),
 * });
 * ```
 */
export function generateFilterSchema<T extends TableSchemaDefinition>(
  schema: T,
): Schema<GeneratedFilterDef<T>>;
export function generateFilterSchema<
  T extends TableSchemaDefinition,
  E extends SchemaDefinition,
>(schema: T, extraFields: E): Schema<GeneratedFilterDef<T> & E>;
export function generateFilterSchema<
  T extends TableSchemaDefinition,
  E extends SchemaDefinition,
>(schema: T, extraFields?: E) {
  const generated = buildFilterDefinition(schema);
  const merged = extraFields ? { ...generated, ...extraFields } : generated;
  return createSchema(merged);
}

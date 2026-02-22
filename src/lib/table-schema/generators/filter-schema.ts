import {
  ARRAY_DELIMITER,
  RANGE_DELIMITER,
  SLIDER_DELIMITER,
} from "@/lib/delimiters";
import { createSchema, field } from "@/lib/store/schema";
import type { SchemaDefinition } from "@/lib/store/schema";
import type { TableSchemaDefinition } from "../types";

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
 * Non-filterable fields are excluded. Pagination/UI-state fields must be
 * composed separately:
 *
 * @example
 * ```ts
 * export const filterSchema = createSchema({
 *   ...generateFilterSchema(tableSchema).definition,
 *   sort: field.sort(),
 *   live: field.boolean().default(false),
 * });
 * ```
 */
export function generateFilterSchema(
  schema: TableSchemaDefinition,
): ReturnType<typeof createSchema<SchemaDefinition>> {
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

  return createSchema(definition);
}

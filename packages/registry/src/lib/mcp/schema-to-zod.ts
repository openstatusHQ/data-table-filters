import type { FieldConfig, SchemaDefinition } from "@dtf/registry/lib/store/schema";
import { z, type ZodTypeAny } from "zod";

/**
 * Convert a single FieldConfig to its Zod equivalent.
 */
function fieldConfigToZod(config: FieldConfig<unknown>): ZodTypeAny {
  switch (config.type) {
    case "string":
      return z.string().optional();
    case "number":
      return z.number().optional();
    case "boolean":
      return z.boolean().optional();
    case "timestamp":
      return z.number().optional().describe("Unix ms");
    case "stringLiteral":
      if (config.literals && config.literals.length > 0) {
        return z
          .enum(config.literals as unknown as [string, ...string[]])
          .optional();
      }
      return z.string().optional();
    case "sort":
      return z.object({ id: z.string(), desc: z.boolean() }).optional();
    case "array": {
      const itemZod = config.itemConfig
        ? fieldConfigToZod(config.itemConfig)
        : z.unknown();
      // Remove .optional() from item schema inside arrays
      const unwrapped =
        itemZod instanceof z.ZodOptional ? itemZod.unwrap() : itemZod;
      return z.array(unwrapped).optional();
    }
    default:
      return z.unknown().optional();
  }
}

/**
 * Convert a SchemaDefinition to a Zod object schema for the `filters` parameter.
 * The SDK auto-converts Zod → JSON Schema for tools/list.
 */
export function schemaToZod(
  schema: SchemaDefinition,
): z.ZodObject<Record<string, ZodTypeAny>> {
  const shape: Record<string, ZodTypeAny> = {};
  for (const [key, fieldBuilder] of Object.entries(schema)) {
    shape[key] = fieldConfigToZod(fieldBuilder._config);
  }
  return z.object(shape);
}

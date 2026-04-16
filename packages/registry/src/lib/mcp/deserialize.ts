import type { FieldConfig, SchemaDefinition } from "@/lib/store/schema";

/**
 * Deserialize raw MCP JSON values into typed values based on the schema.
 * Only timestamps need conversion (number → Date). All other types pass through.
 */
export function deserializeFilters(
  schema: SchemaDefinition,
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined || value === null) continue;

    const fieldBuilder = schema[key];
    if (!fieldBuilder) continue;

    result[key] = deserializeValue(fieldBuilder._config, value);
  }

  return result;
}

function deserializeValue(
  config: FieldConfig<unknown>,
  value: unknown,
): unknown {
  if (config.type === "timestamp" && typeof value === "number") {
    return new Date(value);
  }

  if (config.type === "array" && Array.isArray(value) && config.itemConfig) {
    return value.map((item) => deserializeValue(config.itemConfig!, item));
  }

  return value;
}

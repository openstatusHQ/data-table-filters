import type { TableSchemaDefinition } from "./types";

/**
 * Validates a table schema definition and throws a descriptive error on the
 * first violation found.
 *
 * Called automatically by `createTableSchema()` — no need to call manually.
 *
 * Catches errors that the TypeScript type system cannot prevent:
 * - Missing label (`.label()` was never called)
 * - Slider `min` greater than `max`
 *
 * These checks run for both the TypeScript-authored path (`createTableSchema({...})`)
 * and the AI-generated path (`createTableSchema.fromJSON(json)`).
 */
export function validateSchema(definition: TableSchemaDefinition): void {
  for (const [key, builder] of Object.entries(definition)) {
    const c = builder._config;

    // 1. Label is required — col.* factories default to label: ""
    if (!c.label) {
      throw new Error(
        `[createTableSchema] Column "${key}" is missing a label.\n` +
          `  Fix: .label("${key[0]!.toUpperCase()}${key.slice(1)}")`,
      );
    }

    // 2. Slider bounds must be valid — type system requires { min, max } to be
    //    passed but cannot enforce min < max
    if (c.filter?.type === "slider") {
      const { min, max } = c.filter;
      if (min === undefined || max === undefined) {
        throw new Error(
          `[createTableSchema] Column "${key}": slider filter is missing min/max bounds.\n` +
            `  Fix: .filterable("slider", { min: 0, max: 100 })`,
        );
      }
      if (min > max) {
        throw new Error(
          `[createTableSchema] Column "${key}": slider min (${min}) must be less than max (${max}).\n` +
            `  Fix: swap the values — .filterable("slider", { min: ${max}, max: ${min} })`,
        );
      }
    }
  }
}

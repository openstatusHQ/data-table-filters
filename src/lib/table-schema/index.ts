export { col } from "./col";
export type {
  ColBuilder,
  ColConfig,
  ColKind,
  DisplayConfig,
  FilterConfig,
  InferTableType,
  SheetConfig,
  TableSchemaDefinition,
} from "./types";
export { generateColumns } from "./generators/columns";
export { generateFilterFields } from "./generators/filter-fields";
export { generateFilterSchema } from "./generators/filter-schema";
export { generateSheetFields } from "./generators/sheet-fields";

/**
 * Derive defaultColumnVisibility from the schema.
 * Returns { [key]: false } for every column marked with .hidden().
 */
export function getDefaultColumnVisibility(
  schema: import("./types").TableSchemaDefinition,
): Record<string, boolean> {
  const visibility: Record<string, boolean> = {};
  for (const [key, builder] of Object.entries(schema)) {
    if (builder._config.hidden) {
      visibility[key] = false;
    }
  }
  return visibility;
}

/**
 * Create a table schema from a map of col.* builders.
 *
 * The returned object holds the definition and exposes a _type for
 * TypeScript inference via InferTableType<typeof tableSchema>.
 *
 * @example
 * ```ts
 * export const tableSchema = createTableSchema({
 *   level: col.enum(LEVELS).label("Level").defaultOpen().sheet(),
 *   date: col.timestamp().label("Date").sortable().size(200).sheet(),
 * });
 *
 * export type ColumnSchema = InferTableType<typeof tableSchema>;
 * ```
 */
export function createTableSchema<
  T extends Record<string, import("./types").ColBuilder<unknown>>,
>(definition: T): { definition: T } {
  return { definition };
}

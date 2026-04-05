import { field } from "@/lib/store/schema";
import { generateFilterSchema } from "@/lib/table-schema/generators/filter-schema";
import { tableSchema } from "./table-schema";

const DIRECTIONS = ["prev", "next"] as const;

export const filterSchema = generateFilterSchema(tableSchema.definition, {
  // Sorting
  sort: field.sort(),
  // Selection
  uuid: field.string(),
  // Live mode
  live: field.boolean().default(false),
  // Pagination
  size: field.number().default(40),
  direction: field.stringLiteral(DIRECTIONS).default("next"),
  cursor: field.timestamp(), // null = "now" (handled in query-options)
});

export type FilterState = typeof filterSchema._type;

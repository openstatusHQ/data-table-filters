/**
 * Default Route Schema - BYOS (Bring Your Own Store)
 *
 * This file defines the filter schema using the new BYOS system.
 * It coexists with search-params.ts for backward compatibility.
 */

import { REGIONS } from "@/constants/region";
import { TAGS } from "@/constants/tag";
import { createSchema, field } from "@/lib/store/schema";

/**
 * Filter schema for the default data table
 */
export const filterSchema = createSchema({
  // Text input filter
  url: field.string(),
  name: field.string(),

  // Slider filter (range)
  p95: field.array(field.number()).delimiter("-"),

  // Checkbox filters (arrays)
  public: field.array(field.boolean()).delimiter(","),
  active: field.array(field.boolean()).delimiter(","),
  regions: field.array(field.stringLiteral(REGIONS)).delimiter(","),
  tags: field.array(field.stringLiteral(TAGS)).delimiter(","),

  // Date range filter
  date: field.array(field.timestamp()).delimiter("-"),
});

/**
 * Inferred type from schema
 */
export type FilterState = typeof filterSchema._type;

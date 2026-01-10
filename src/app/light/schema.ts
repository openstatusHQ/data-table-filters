import { LEVELS } from "@/constants/levels";
import { METHODS } from "@/constants/method";
import { VERCEL_EDGE_REGIONS } from "@/constants/region";
import {
  ARRAY_DELIMITER,
  RANGE_DELIMITER,
  SLIDER_DELIMITER,
} from "@/lib/delimiters";
import { createSchema, field } from "@/lib/store/schema";

// BYOS filter schema
export const filterSchema = createSchema({
  // Filters
  level: field.array(field.stringLiteral(LEVELS)),
  latency: field.array(field.number()).delimiter(SLIDER_DELIMITER),
  status: field.array(field.number()).delimiter(SLIDER_DELIMITER),
  region: field.array(field.stringLiteral(VERCEL_EDGE_REGIONS)),
  method: field.array(field.stringLiteral(METHODS)),
  url: field.string(),
  timestamp: field.array(field.timestamp()).delimiter(RANGE_DELIMITER),
  // Sorting
  sort: field.sort(),
  // Selection
  uuid: field.string(),
});

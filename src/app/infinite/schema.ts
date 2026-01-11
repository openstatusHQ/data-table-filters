import { LEVELS } from "@/constants/levels";
import { METHODS } from "@/constants/method";
import { REGIONS } from "@/constants/region";
import {
  ARRAY_DELIMITER,
  RANGE_DELIMITER,
  SLIDER_DELIMITER,
} from "@/lib/delimiters";
import { createSchema, field } from "@/lib/store/schema";
import { z } from "zod";

export const timingSchema = z.object({
  "timing.dns": z.number(),
  "timing.connection": z.number(),
  "timing.tls": z.number(),
  "timing.ttfb": z.number(),
  "timing.transfer": z.number(),
});

export const columnSchema = z
  .object({
    uuid: z.string(),
    method: z.enum(METHODS),
    host: z.string(),
    pathname: z.string(),
    level: z.enum(LEVELS),
    latency: z.number(),
    status: z.number(),
    regions: z.enum(REGIONS).array(),
    date: z.date(),
    headers: z.record(z.string()),
    message: z.string().optional(),
    percentile: z.number().optional(),
  })
  .merge(timingSchema);

export type ColumnSchema = z.infer<typeof columnSchema>;
export type TimingSchema = z.infer<typeof timingSchema>;

export const facetMetadataSchema = z.object({
  rows: z.array(z.object({ value: z.any(), total: z.number() })),
  total: z.number(),
  min: z.number().optional(),
  max: z.number().optional(),
});

export type FacetMetadataSchema = z.infer<typeof facetMetadataSchema>;

export type BaseChartSchema = { timestamp: number; [key: string]: number };

export const timelineChartSchema = z.object({
  timestamp: z.number(), // UNIX
  ...LEVELS.reduce(
    (acc, level) => ({
      ...acc,
      [level]: z.number().default(0),
    }),
    {} as Record<(typeof LEVELS)[number], z.ZodNumber>,
  ),
  // REMINDER: make sure to have the `timestamp` field in the object
}) satisfies z.ZodType<BaseChartSchema>;

export type TimelineChartSchema = z.infer<typeof timelineChartSchema>;

// Direction type for pagination
const DIRECTIONS = ["prev", "next"] as const;

// BYOS filter schema
export const filterSchema = createSchema({
  // Filters
  level: field.array(field.stringLiteral(LEVELS)),
  method: field.array(field.stringLiteral(METHODS)),
  host: field.string(),
  pathname: field.string(),
  latency: field.array(field.number()).delimiter(SLIDER_DELIMITER),
  "timing.dns": field.array(field.number()).delimiter(SLIDER_DELIMITER),
  "timing.connection": field.array(field.number()).delimiter(SLIDER_DELIMITER),
  "timing.tls": field.array(field.number()).delimiter(SLIDER_DELIMITER),
  "timing.ttfb": field.array(field.number()).delimiter(SLIDER_DELIMITER),
  "timing.transfer": field.array(field.number()).delimiter(SLIDER_DELIMITER),
  status: field.array(field.number()).delimiter(ARRAY_DELIMITER),
  regions: field.array(field.stringLiteral(REGIONS)),
  date: field.array(field.timestamp()).delimiter(RANGE_DELIMITER),
  // Sorting
  sort: field.sort(),
  // Selection
  uuid: field.string(),
  // Live mode
  live: field.boolean().default(false),
  // Pagination
  size: field.number().default(40),
  start: field.number().default(0),
  direction: field.stringLiteral(DIRECTIONS).default("next"),
  cursor: field.timestamp(), // null = "now" (handled in query-options)
});

// Inferred filter state type for use with useFilterState
export type FilterState = typeof filterSchema._type;

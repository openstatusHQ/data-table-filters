import { LEVELS } from "@/constants/levels";
import { METHODS } from "@/constants/method";
import { REGIONS } from "@/constants/region";
import type { BaseChartSchema } from "@/lib/data-table/types";
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
    headers: z.record(z.string(), z.string()),
    message: z.string().optional(),
    percentile: z.number().optional(),
  })
  .extend(timingSchema.shape);

export type ColumnSchema = z.infer<typeof columnSchema>;
export type TimingSchema = z.infer<typeof timingSchema>;

// Re-export generic types from shared location
export {
  facetMetadataSchema,
  type FacetMetadataSchema,
} from "@/lib/data-table/types";

export type { BaseChartSchema };

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

// BYOS filter schema — derived from tableSchema.definition via generateFilterSchema
export { filterSchema, type FilterState } from "./filter-schema";

import {
  ARRAY_DELIMITER,
  RANGE_DELIMITER,
  SLIDER_DELIMITER,
} from "@/lib/delimiters";
import { METHODS } from "@/constants/method";
import { z } from "zod";
import { LEVELS } from "@/constants/levels";

export const columnSchema = z.object({
  uuid: z.string(),
  method: z.enum(METHODS),
  host: z.string(),
  pathname: z.string(),
  level: z.enum(LEVELS),
  latency: z.number(),
  status: z.number(),
  date: z.date(),
  headers: z.record(z.string()),
  message: z.string().optional(),
  percentile: z.number().optional(),
});

export type ColumnSchema = z.infer<typeof columnSchema>;

// TODO: can we get rid of this in favor of nuqs search-params?
export const columnFilterSchema = z.object({
  level: z
    .string()
    .transform((val) => val.split(ARRAY_DELIMITER))
    .pipe(z.enum(LEVELS).array())
    .optional(),
  method: z
    .string()
    .transform((val) => val.split(ARRAY_DELIMITER))
    .pipe(z.enum(METHODS).array())
    .optional(),
  host: z.string().optional(),
  pathname: z.string().optional(),
  latency: z
    .string()
    .transform((val) => val.split(SLIDER_DELIMITER))
    .pipe(z.coerce.number().array().max(2))
    .optional(),
  status: z
    .string()
    .transform((val) => val.split(ARRAY_DELIMITER))
    .pipe(z.coerce.number().array())
    .optional(),
  date: z
    .string()
    .transform((val) => val.split(RANGE_DELIMITER).map(Number))
    .pipe(z.coerce.date().array())
    .optional(),
});

export type ColumnFilterSchema = z.infer<typeof columnFilterSchema>;

export const facetMetadataSchema = z.object({
  rows: z.array(z.object({ value: z.any(), total: z.number() })),
  total: z.number(),
  min: z.number().optional(),
  max: z.number().optional(),
});

export type FacetMetadataSchema = z.infer<typeof facetMetadataSchema>;

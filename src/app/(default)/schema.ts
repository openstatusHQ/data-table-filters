import { z } from "zod";

/** Strings used to separate the URL params */
export const ARRAY_DELIMITER = ",";
export const SLIDER_DELIMITER = "-";
export const SPACE_DELIMITER = "_";
export const RANGE_DELIMITER = "-";

export const REGIONS = ["ams", "gru", "syd", "hkg", "fra", "iad"] as const;
export const TAGS = ["web", "api", "enterprise", "app"] as const;

// https://github.com/colinhacks/zod/issues/2985#issue-2008642190
const stringToBoolean = z
  .string()
  .toLowerCase()
  .transform((val) => {
    try {
      return JSON.parse(val);
    } catch (e) {
      console.log(e);
      return undefined;
    }
  })
  .pipe(z.boolean().optional());

export const columnSchema = z.object({
  name: z.string(),
  url: z.string(),
  // p75
  p95: z.number().optional(),
  // p99
  public: z.boolean(),
  active: z.boolean(),
  regions: z.enum(REGIONS).array(),
  tags: z.enum(TAGS).array(),
  date: z.date(),
});

export type ColumnSchema = z.infer<typeof columnSchema>;

export const columnFilterSchema = z.object({
  url: z.string().optional(),
  p95: z
    .string()
    .transform((val) => val.split(SLIDER_DELIMITER))
    .pipe(z.coerce.number().array().max(2))
    .optional(), // TBD: we could transform to `{ min: x, max: y}`
  public: z
    .string()
    .transform((val) => val.split(ARRAY_DELIMITER))
    .pipe(stringToBoolean.array())
    .optional(),
  active: z
    .string()
    .transform((val) => val.split(ARRAY_DELIMITER))
    .pipe(stringToBoolean.array())
    .optional(),
  regions: z
    .string()
    .transform((val) => val.split(ARRAY_DELIMITER))
    .pipe(z.enum(REGIONS).array())
    .optional(),
  tags: z
    .string()
    .transform((val) => val.split(ARRAY_DELIMITER))
    .pipe(z.enum(TAGS).array())
    .optional(),
  date: z
    .string()
    .transform((val) => val.split(RANGE_DELIMITER).map(Number))
    .pipe(z.coerce.date().array())
    .optional(),
});

export type ColumnFilterSchema = z.infer<typeof columnFilterSchema>;

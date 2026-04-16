import { col, createTableSchema } from "@dtf/registry/lib/table-schema";

const LEVELS = ["info", "warn", "error"] as const;
const REGIONS = ["ams", "gru", "fra", "iad"] as const;

/**
 * Shared test schema covering all filter types:
 * - level: checkbox (enum)
 * - host: input (string)
 * - latency: slider (number, 0-5000, unit ms)
 * - date: timerange (timestamp, commandDisabled)
 * - regions: checkbox (array of enum)
 * - status: input (number)
 * - message: not filterable
 */
export const testSchema = createTableSchema({
  level: col
    .enum(LEVELS)
    .label("Level")
    .description("Log severity level")
    .filterable("checkbox"),
  host: col.string().label("Host").filterable("input"),
  latency: col
    .number()
    .label("Latency")
    .description("Round-trip time in ms")
    .display("number", { unit: "ms" })
    .filterable("slider", { min: 0, max: 5000, unit: "ms" }),
  date: col.timestamp().label("Date").filterable("timerange").commandDisabled(),
  regions: col
    .array(col.enum(REGIONS))
    .label("Regions")
    .filterable("checkbox", {
      options: REGIONS.map((r) => ({ label: r, value: r })),
    }),
  status: col.number().label("Status Code").filterable("input"),
  message: col.string().label("Message").notFilterable(),
});

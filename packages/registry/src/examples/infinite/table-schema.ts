import {
  col,
  createTableSchema,
  type InferTableType,
} from "@dtf/registry/lib/table-schema";

export const LEVELS = ["error", "warning", "info"] as const;
export const METHODS = ["GET", "POST", "PUT", "DELETE"] as const;
export const REGIONS = ["ams", "fra", "iad", "syd"] as const;
export const STATUS_CODES = [200, 201, 400, 404, 500];

/**
 * The one definition the whole example reads from. The columns, the filter
 * sidebar, the command palette, the row sheet and the mock API's filter
 * semantics are all generated from it, so a column added here shows up on
 * every surface.
 */
export const tableSchema = createTableSchema({
  level: col.presets
    .logLevel(LEVELS)
    .display("level-indicator")
    .hideHeader()
    .size(37),
  date: col.presets
    .timestamp()
    .label("Date")
    .defaultOpen()
    .commandDisabled()
    // The one unsized column: it absorbs the table's leftover width.
    .minSize(200)
    .sheet(),
  status: col.presets.httpStatus(STATUS_CODES).size(70).sheet(),
  method: col.presets.httpMethod(METHODS).size(80).sheet(),
  pathname: col.presets.pathname().size(220).sheet(),
  region: col
    .enum(REGIONS)
    .label("Region")
    .display("badge")
    .filterable("checkbox", {
      options: REGIONS.map((region) => ({ label: region, value: region })),
    })
    .size(90)
    .sheet(),
  latency: col.presets.latency("ms").label("Latency").size(110).sheet(),
  uuid: col.presets.traceId().label("Request ID").hidden().sheet(),
});

export type ColumnSchema = InferTableType<typeof tableSchema.definition>;

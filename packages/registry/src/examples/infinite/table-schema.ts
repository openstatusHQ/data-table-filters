import {
  col,
  createTableSchema,
  type InferTableType,
} from "@dtf/registry/lib/table-schema";
import { SheetTimingPhases } from "./timing-phases";

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
    .size(37)
    .sheet(),
  date: col.presets
    .timestamp()
    .label("Date")
    // The mock API returns rows newest-first and does not sort; the header
    // must not promise what the endpoint cannot deliver.
    .sortable(false)
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
  latency: col.presets
    .latency("ms")
    .label("Latency")
    .sortable(false)
    .size(110)
    .sheet(),

  // The five phases behind `timingPhasesColumn`: hidden from the table by
  // default (toggle them in the column settings), each filterable by range,
  // and shown together as one sheet section hung off the first.
  "timing.dns": col.presets
    .duration("ms")
    .label("DNS")
    .size(110)
    .hidden()
    .sheet({
      label: "Timing Phases",
      component: SheetTimingPhases,
      className: "flex-col items-start w-full gap-1",
    }),
  "timing.connection": col.presets
    .duration("ms")
    .label("Connection")
    .size(110)
    .hidden(),
  "timing.tls": col.presets.duration("ms").label("TLS").size(110).hidden(),
  "timing.ttfb": col.presets.duration("ms").label("TTFB").size(110).hidden(),
  "timing.transfer": col.presets
    .duration("ms")
    .label("Transfer")
    .size(110)
    .hidden(),
  uuid: col.presets.traceId().label("Request ID").hidden().sheet(),
});

export type ColumnSchema = InferTableType<typeof tableSchema.definition>;

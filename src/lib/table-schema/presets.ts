import { col } from "./col";
import type { ColBuilder } from "./types";

const DEFAULT_HTTP_STATUS_CODES = [
  200, 201, 204, 301, 302, 400, 401, 403, 404, 422, 429, 500, 502, 503, 504,
];

/**
 * Pre-configured column builders for patterns common in log and observability tables.
 *
 * Every preset returns a `ColBuilder` with sensible defaults already applied.
 * All builders remain fully customizable — chain additional methods to override
 * any default (label, size, display, sheet, etc.).
 *
 * @example
 * ```ts
 * const tableSchema = createTableSchema({
 *   level:   col.presets.logLevel(LEVELS).description("Log severity"),
 *   date:    col.presets.timestamp().label("Date").size(200).sheet(),
 *   latency: col.presets.duration("ms").label("Latency").sortable().size(110).sheet(),
 *   status:  col.presets.httpStatus().label("Status").size(60),
 *   method:  col.presets.httpMethod(METHODS).size(69),
 *   path:    col.presets.pathname().label("Path").size(130).sheet(),
 *   traceId: col.presets.traceId().label("Request ID").hidden().sheet(),
 * });
 * ```
 */
export const presets = {
  /**
   * A log severity level column.
   *
   * Defaults: enum + badge display + checkbox filter + `defaultOpen`.
   * Checkbox options are auto-derived from `values` — no need to map them manually.
   *
   * @param values - The allowed severity levels, e.g. `["error", "warn", "info", "debug"] as const`
   *
   * @example
   * ```ts
   * col.presets.logLevel(LEVELS)
   *   .label("Level")
   *   .description("Log severity: error > warn > info > debug")
   *   .size(27)
   * ```
   */
  logLevel<T extends readonly string[]>(
    values: T,
  ): ColBuilder<T[number], "checkbox"> {
    return col
      .enum(values)
      .label("Level")
      .filterable("checkbox", {
        options: values.map((v) => ({ label: v, value: v })),
      })
      .defaultOpen();
  },

  /**
   * An HTTP method column.
   *
   * Defaults: enum + plain text display + checkbox filter.
   * Options are auto-derived from `values`.
   *
   * @param values - The allowed HTTP methods, e.g. `["GET", "POST", "PUT", "DELETE"] as const`
   *
   * @example
   * ```ts
   * col.presets.httpMethod(METHODS).size(69)
   * ```
   */
  httpMethod<T extends readonly string[]>(
    values: T,
  ): ColBuilder<T[number], "checkbox"> {
    return col
      .enum(values)
      .label("Method")
      .display("text")
      .filterable("checkbox", {
        options: values.map((v) => ({ label: v, value: v })),
      });
  },

  /**
   * An HTTP status code column.
   *
   * Defaults: number + checkbox filter with a standard set of common status codes.
   * Pass a custom `codes` array to override the defaults.
   *
   * Default codes: 200, 201, 204, 301, 302, 400, 401, 403, 404, 422, 429, 500, 502, 503, 504
   *
   * @param codes - Override the default status code options
   *
   * @example
   * ```ts
   * col.presets.httpStatus().label("Status").size(60)
   * col.presets.httpStatus([200, 400, 500]).label("Status") // custom codes
   * ```
   */
  httpStatus(
    codes?: number[],
  ): ColBuilder<number, "input" | "slider" | "checkbox"> {
    return col
      .number()
      .label("Status")
      .filterable("checkbox", {
        options: (codes ?? DEFAULT_HTTP_STATUS_CODES).map((code) => ({
          label: String(code),
          value: code,
        })),
      });
  },

  /**
   * A duration / latency / timing column.
   *
   * Defaults: number + formatted number display with unit + slider filter
   * with bounds `{ min: 0, max: 5000 }`.
   *
   * @param unit   - Unit label shown after the value, e.g. `"ms"`, `"s"`, `"µs"`
   * @param slider - Override the slider bounds (default: `{ min: 0, max: 5000 }`)
   *
   * @example
   * ```ts
   * col.presets.duration("ms").label("Latency").sortable().size(110).sheet()
   * col.presets.duration("s", { min: 0, max: 60 }).label("Response time")
   * ```
   */
  duration(
    unit?: string,
    slider?: { min: number; max: number },
  ): ColBuilder<number, "input" | "slider" | "checkbox"> {
    return col
      .number()
      .label("Duration")
      .display("number", { unit })
      .filterable("slider", slider ?? { min: 0, max: 5000 });
  },

  /**
   * A timestamp column.
   *
   * Defaults: Date + relative timestamp display (absolute on hover) +
   * timerange filter + sortable.
   *
   * @example
   * ```ts
   * col.presets.timestamp().label("Date").commandDisabled().size(200).sheet()
   * ```
   */
  timestamp(): ColBuilder<Date, "timerange"> {
    return col.timestamp().label("Timestamp").display("timestamp").sortable();
  },

  /**
   * A trace / span / request ID column.
   *
   * Defaults: string + monospace code display + not filterable.
   * Typically hidden in the table and shown only in the row detail drawer.
   *
   * @example
   * ```ts
   * col.presets.traceId().label("Request ID").hidden().sheet({ skeletonClassName: "w-64" })
   * ```
   */
  traceId(): ColBuilder<string, never> {
    return col.string().label("Trace ID").display("code").notFilterable();
  },

  /**
   * A URL pathname column.
   *
   * Defaults: string + plain text display + input (text search) filter.
   *
   * @example
   * ```ts
   * col.presets.pathname().size(130).sheet()
   * ```
   */
  pathname(): ColBuilder<string, "input"> {
    return col.string().label("Pathname").filterable("input");
  },
};

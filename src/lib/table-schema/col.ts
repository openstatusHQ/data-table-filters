import type {
  ColBuilder,
  ColConfig,
  DisplayConfig,
  FilterConfig,
  FilterType,
  SheetConfig,
} from "./types";

function createColBuilder<T, F extends FilterType = FilterType>(
  config: ColConfig,
): ColBuilder<T, F> {
  // The implementation uses loose parameter types to satisfy all overload
  // signatures at once. TypeScript enforces the constraints at call sites
  // via the ColBuilder<T, F> interface overloads, not here.
  const builder = {
    get _config() {
      return config;
    },

    label(text: string): ColBuilder<T, F> {
      return createColBuilder<T, F>({ ...config, label: text });
    },

    description(text: string): ColBuilder<T, F> {
      return createColBuilder<T, F>({ ...config, description: text });
    },

    display(type: string, options?: Record<string, unknown>): ColBuilder<T, F> {
      const displayConfig = options
        ? ({ type, ...options } as DisplayConfig)
        : ({ type } as DisplayConfig);
      return createColBuilder<T, F>({ ...config, display: displayConfig });
    },

    filterable(
      type?: string,
      options?: Record<string, unknown>,
    ): ColBuilder<T, F> {
      const filterType = (type ||
        config.filter?.type ||
        "input") as FilterConfig["type"];
      const existing = config.filter;
      const newFilter: FilterConfig = {
        type: filterType,
        defaultOpen: existing?.defaultOpen ?? false,
        commandDisabled: existing?.commandDisabled ?? false,
        ...(options ?? {}),
      };
      return createColBuilder<T, F>({ ...config, filter: newFilter });
    },

    notFilterable(): ColBuilder<T, never> {
      return createColBuilder<T, never>({ ...config, filter: null });
    },

    defaultOpen(): ColBuilder<T, F> {
      if (!config.filter) return createColBuilder<T, F>(config);
      return createColBuilder<T, F>({
        ...config,
        filter: { ...config.filter, defaultOpen: true },
      });
    },

    commandDisabled(): ColBuilder<T, F> {
      if (!config.filter) return createColBuilder<T, F>(config);
      return createColBuilder<T, F>({
        ...config,
        filter: { ...config.filter, commandDisabled: true },
      });
    },

    hidden(): ColBuilder<T, F> {
      return createColBuilder<T, F>({ ...config, hidden: true });
    },

    size(px: number): ColBuilder<T, F> {
      return createColBuilder<T, F>({ ...config, size: px });
    },

    sortable(): ColBuilder<T, F> {
      return createColBuilder<T, F>({ ...config, sortable: true });
    },

    optional(): ColBuilder<T | undefined, F> {
      return createColBuilder<T | undefined, F>({ ...config, optional: true });
    },

    sheet(sheetConfig?: SheetConfig): ColBuilder<T, F> {
      return createColBuilder<T, F>({ ...config, sheet: sheetConfig ?? {} });
    },
  } as ColBuilder<T, F>;

  return builder;
}

/**
 * A string column.
 *
 * - Data type: `string`
 * - Default display: `"text"` (plain text with overflow tooltip)
 * - Default filter: `"input"` (text search)
 * - Allowed filters: `"input"`
 *
 * @example
 * col.string().label("Host").size(125).sheet()
 * col.string().label("Message").notFilterable().optional().hidden()
 */
function string(): ColBuilder<string, "input"> {
  return createColBuilder<string, "input">({
    kind: "string",
    optional: false,
    label: "",
    display: { type: "text" },
    hidden: false,
    sortable: false,
    filter: { type: "input", defaultOpen: false, commandDisabled: false },
    sheet: null,
  });
}

/**
 * A numeric column.
 *
 * - Data type: `number`
 * - Default display: `"number"` (formatted, with optional unit)
 * - Default filter: `"input"` (exact match)
 * - Allowed filters: `"input"` | `"slider"` | `"checkbox"`
 *   - Use `"slider"` for continuous values (latency, file size)
 *   - Use `"checkbox"` for discrete values (HTTP status codes, port numbers)
 *
 * @example
 * col.number().label("Latency").display("number", { unit: "ms" }).filterable("slider", { min: 0, max: 5000 }).sortable()
 * col.number().label("Status").filterable("checkbox", { options: [{ label: "200", value: 200 }] })
 */
function number(): ColBuilder<number, "input" | "slider" | "checkbox"> {
  return createColBuilder<number, "input" | "slider" | "checkbox">({
    kind: "number",
    optional: false,
    label: "",
    display: { type: "number" },
    hidden: false,
    sortable: false,
    filter: { type: "input", defaultOpen: false, commandDisabled: false },
    sheet: null,
  });
}

/**
 * A boolean column.
 *
 * - Data type: `boolean`
 * - Default display: `"boolean"` (checkmark / dash icon)
 * - Default filter: `"checkbox"` with `Yes` / `No` options pre-wired
 * - Allowed filters: `"checkbox"`
 *
 * @example
 * col.boolean().label("Cache Hit").defaultOpen()
 */
function boolean(): ColBuilder<boolean, "checkbox"> {
  return createColBuilder<boolean, "checkbox">({
    kind: "boolean",
    optional: false,
    label: "",
    display: { type: "boolean" },
    hidden: false,
    sortable: false,
    filter: {
      type: "checkbox",
      defaultOpen: false,
      commandDisabled: false,
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },
    sheet: null,
  });
}

/**
 * A timestamp column.
 *
 * - Data type: `Date`
 * - Default display: `"timestamp"` (relative time, absolute datetime on hover)
 * - Default filter: `"timerange"` (date range picker)
 * - Allowed filters: `"timerange"`
 *
 * @example
 * col.timestamp().label("Date").sortable().commandDisabled().size(200).sheet()
 */
function timestamp(): ColBuilder<Date, "timerange"> {
  return createColBuilder<Date, "timerange">({
    kind: "timestamp",
    optional: false,
    label: "",
    display: { type: "timestamp" },
    hidden: false,
    sortable: false,
    filter: { type: "timerange", defaultOpen: false, commandDisabled: false },
    sheet: null,
  });
}

/**
 * An enum column from a `readonly string[]` union.
 *
 * - Data type: `T[number]` (union of the provided string literals)
 * - Default display: `"badge"` (colored chip)
 * - Default filter: `"checkbox"`
 * - Allowed filters: `"checkbox"`
 *
 * Checkbox options are NOT auto-derived from `values` — provide them via
 * `.filterable("checkbox", { options: [...] })` or use `col.presets.logLevel()`
 * which handles option mapping automatically.
 *
 * @param values - `as const` array of allowed string values
 *
 * @example
 * col.enum(LEVELS).label("Level").filterable("checkbox", {
 *   options: LEVELS.map(v => ({ label: v, value: v })),
 * }).defaultOpen()
 */
function colEnum<T extends readonly string[]>(
  values: T,
): ColBuilder<T[number], "checkbox"> {
  return createColBuilder<T[number], "checkbox">({
    kind: "enum",
    enumValues: values,
    optional: false,
    label: "",
    display: { type: "badge" },
    hidden: false,
    sortable: false,
    filter: { type: "checkbox", defaultOpen: false, commandDisabled: false },
    sheet: null,
  });
}

/**
 * An array column, typically used for multi-value enum fields.
 *
 * - Data type: `U[]` where `U` is the item builder's type
 * - Default display: `"badge"` (colored chip per value)
 * - Default filter: `"checkbox"`
 * - Allowed filters: `"checkbox"`
 *
 * Most commonly used as `col.array(col.enum(values))` for tags / regions / labels.
 *
 * @param itemBuilder - A `ColBuilder` describing the array item type
 *
 * @example
 * col.array(col.enum(REGIONS)).label("Regions").filterable("checkbox", {
 *   options: REGIONS.map(r => ({ label: r, value: r })),
 * })
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function array<U>(
  itemBuilder: ColBuilder<U, any>,
): ColBuilder<U[], "checkbox"> {
  return createColBuilder<U[], "checkbox">({
    kind: "array",
    arrayItem: itemBuilder._config,
    optional: false,
    label: "",
    display: { type: "badge" },
    hidden: false,
    sortable: false,
    filter: { type: "checkbox", defaultOpen: false, commandDisabled: false },
    sheet: null,
  });
}

/**
 * A key-value record column.
 *
 * - Data type: `Record<string, string>`
 * - Default display: `"text"`
 * - Not filterable (`F = never`)
 *
 * Use for metadata maps, HTTP headers, environment variables, etc.
 * Typically rendered with a custom sheet component (key-value table / tabs).
 *
 * @example
 * col.record().label("Headers").hidden().sheet({
 *   component: (row) => <KVTabs data={row.headers} />,
 *   className: "flex-col items-start w-full gap-1",
 * })
 */
function record(): ColBuilder<Record<string, string>, never> {
  return createColBuilder<Record<string, string>, never>({
    kind: "record",
    optional: false,
    label: "",
    display: { type: "text" },
    hidden: false,
    sortable: false,
    filter: null,
    sheet: null,
  });
}

export const col = {
  string,
  number,
  boolean,
  timestamp,
  enum: colEnum,
  array,
  record,
};

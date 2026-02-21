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

    display(
      type: string,
      options?: Record<string, unknown>,
    ): ColBuilder<T, F> {
      const displayConfig = options
        ? ({ type, ...options } as DisplayConfig)
        : ({ type } as DisplayConfig);
      return createColBuilder<T, F>({ ...config, display: displayConfig });
    },

    filterable(
      type?: string,
      options?: Record<string, unknown>,
    ): ColBuilder<T, F> {
      const filterType = (
        type || config.filter?.type || "input"
      ) as FilterConfig["type"];
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function array<U>(itemBuilder: ColBuilder<U, any>): ColBuilder<U[], "checkbox"> {
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

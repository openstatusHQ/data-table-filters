import type {
  ColBuilder,
  ColConfig,
  DisplayConfig,
  FilterConfig,
  SheetConfig,
} from "./types";

function createColBuilder<T>(config: ColConfig): ColBuilder<T> {
  const builder: ColBuilder<T> = {
    get _config() {
      return config;
    },

    label(text: string): ColBuilder<T> {
      return createColBuilder<T>({ ...config, label: text });
    },

    description(text: string): ColBuilder<T> {
      return createColBuilder<T>({ ...config, description: text });
    },

    display(
      type: string,
      options?: Record<string, unknown>,
    ): ColBuilder<T> {
      const displayConfig = options
        ? ({ type, ...options } as DisplayConfig)
        : ({ type } as DisplayConfig);
      return createColBuilder<T>({ ...config, display: displayConfig });
    },

    filterable(
      type?: string,
      options?: Record<string, unknown>,
    ): ColBuilder<T> {
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
      return createColBuilder<T>({ ...config, filter: newFilter });
    },

    notFilterable(): ColBuilder<T> {
      return createColBuilder<T>({ ...config, filter: null });
    },

    defaultOpen(): ColBuilder<T> {
      if (!config.filter) return createColBuilder<T>(config);
      return createColBuilder<T>({
        ...config,
        filter: { ...config.filter, defaultOpen: true },
      });
    },

    commandDisabled(): ColBuilder<T> {
      if (!config.filter) return createColBuilder<T>(config);
      return createColBuilder<T>({
        ...config,
        filter: { ...config.filter, commandDisabled: true },
      });
    },

    hidden(): ColBuilder<T> {
      return createColBuilder<T>({ ...config, hidden: true });
    },

    size(px: number): ColBuilder<T> {
      return createColBuilder<T>({ ...config, size: px });
    },

    sortable(): ColBuilder<T> {
      return createColBuilder<T>({ ...config, sortable: true });
    },

    optional(): ColBuilder<T | undefined> {
      return createColBuilder<T | undefined>({ ...config, optional: true });
    },

    sheet(sheetConfig?: SheetConfig): ColBuilder<T> {
      return createColBuilder<T>({ ...config, sheet: sheetConfig ?? {} });
    },
  };

  return builder;
}

function string(): ColBuilder<string> {
  return createColBuilder<string>({
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

function number(): ColBuilder<number> {
  return createColBuilder<number>({
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

function boolean(): ColBuilder<boolean> {
  return createColBuilder<boolean>({
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

function timestamp(): ColBuilder<Date> {
  return createColBuilder<Date>({
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
): ColBuilder<T[number]> {
  return createColBuilder<T[number]>({
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

function array<U>(itemBuilder: ColBuilder<U>): ColBuilder<U[]> {
  return createColBuilder<U[]>({
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

function record(): ColBuilder<Record<string, string>> {
  return createColBuilder<Record<string, string>>({
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

import {
  ARRAY_DELIMITER,
  RANGE_DELIMITER,
  SLIDER_DELIMITER,
} from "@/lib/delimiters";
import { isArrayOfDates } from "@/lib/is-array";
import type { FieldBuilder, SchemaDefinition } from "@/lib/store/schema/types";
import type { ColumnFiltersState } from "@tanstack/react-table";
import type { DataTableFilterField } from "../types";

/**
 * Extracts the word from the given string at the specified caret position.
 */
export function getWordByCaretPosition({
  value,
  caretPosition,
}: {
  value: string;
  caretPosition: number;
}) {
  let start = caretPosition;
  let end = caretPosition;

  while (start > 0 && value[start - 1] !== " ") start--;
  while (end < value.length && value[end] !== " ") end++;

  const word = value.substring(start, end);
  return word;
}

/**
 * Quote a value if it contains spaces
 */
function quoteIfNeeded(val: string | number | boolean | undefined): string {
  const str = `${val}`;
  if (str.includes(" ")) {
    return `"${str}"`;
  }
  return str;
}

export function replaceInputByFieldType<TData>({
  prev,
  currentWord,
  optionValue,
  value,
  field,
}: {
  prev: string;
  currentWord: string;
  optionValue?: string | number | boolean | undefined; // FIXME: use DataTableFilterField<TData>["options"][number];
  value: string;
  field: DataTableFilterField<TData>;
}) {
  switch (field.type) {
    case "checkbox": {
      if (currentWord.includes(ARRAY_DELIMITER)) {
        const words = currentWord.split(ARRAY_DELIMITER);
        words[words.length - 1] = quoteIfNeeded(optionValue);
        const input = prev.replace(currentWord, words.join(ARRAY_DELIMITER));
        return `${input.trim()} `;
      }
    }
    case "slider": {
      if (currentWord.includes(SLIDER_DELIMITER)) {
        const words = currentWord.split(SLIDER_DELIMITER);
        words[words.length - 1] = `${optionValue}`;
        const input = prev.replace(currentWord, words.join(SLIDER_DELIMITER));
        return `${input.trim()} `;
      }
    }
    case "timerange": {
      if (currentWord.includes(RANGE_DELIMITER)) {
        const words = currentWord.split(RANGE_DELIMITER);
        words[words.length - 1] = `${optionValue}`;
        const input = prev.replace(currentWord, words.join(RANGE_DELIMITER));
        return `${input.trim()} `;
      }
    }
    default: {
      // Quote the value if it contains spaces
      const quotedValue = quoteIfNeeded(optionValue) || value;
      const input = prev.replace(
        currentWord,
        `${String(field.value)}:${quotedValue}`,
      );
      return `${input.trim()} `;
    }
  }
}

export function getFieldOptions<TData>({
  field,
}: {
  field: DataTableFilterField<TData>;
}) {
  switch (field.type) {
    case "slider": {
      return field.options?.length
        ? field.options
            .map(({ value }) => value)
            .sort((a, b) => Number(a) - Number(b))
            .filter(notEmpty)
        : Array.from(
            { length: field.max - field.min + 1 },
            (_, i) => field.min + i,
          ) || [];
    }
    default: {
      return field.options?.map(({ value }) => value).filter(notEmpty) || [];
    }
  }
}

export function getFilterValue({
  value,
  search,
  currentWord,
}: {
  value: string;
  search: string;
  keywords?: string[] | undefined;
  currentWord: string;
}): number {
  /**
   * @example value "suggestion:public:true regions,ams,gru,fra"
   */
  if (value.startsWith("suggestion:")) {
    const rawValue = value.toLowerCase().replace("suggestion:", "");
    if (rawValue.includes(search)) return 1;
    return 0;
  }

  /** */
  if (value.toLowerCase().includes(currentWord.toLowerCase())) return 1;

  /**
   * @example checkbox [filter, query] = ["regions", "ams,gru,fra"]
   * @example slider [filter, query] = ["p95", "0-3000"]
   * @example input [filter, query] = ["name", "api"]
   */
  const [filter, query] = currentWord.toLowerCase().split(":");
  if (query && value.startsWith(`${filter}:`)) {
    if (query.includes(ARRAY_DELIMITER)) {
      /**
       * array of n elements
       * @example queries = ["ams", "gru", "fra"]
       */
      const queries = query.split(ARRAY_DELIMITER);
      const rawValue = value.toLowerCase().replace(`${filter}:`, "");
      if (
        queries.some((item, i) => item === rawValue && i !== queries.length - 1)
      )
        return 0;
      if (queries.some((item) => rawValue.includes(item))) return 1;
    }
    if (query.includes(SLIDER_DELIMITER)) {
      /**
       * range between 2 elements
       * @example queries = ["0", "3000"]
       */
      const queries = query.split(SLIDER_DELIMITER);
      const rawValue = value.toLowerCase().replace(`${filter}:`, "");

      const rawValueAsNumber = Number.parseInt(rawValue);
      const queryAsNumber = Number.parseInt(queries[0]);

      if (queryAsNumber < rawValueAsNumber) {
        if (rawValue.includes(queries[1])) return 1;
        return 0;
      }
      return 0;
    }
    const rawValue = value.toLowerCase().replace(`${filter}:`, "");
    if (rawValue.includes(query)) return 1;
  }
  return 0;
}

export function getFieldValueByType<TData>({
  field,
  value,
}: {
  field?: DataTableFilterField<TData>;
  value: unknown;
}) {
  if (!field) return null;

  switch (field.type) {
    case "slider": {
      if (Array.isArray(value)) {
        return value.join(SLIDER_DELIMITER);
      }
      return value;
    }
    case "checkbox": {
      if (Array.isArray(value)) {
        return value.join(ARRAY_DELIMITER);
      }
      // REMINER: inversed logic
      if (typeof value === "string") {
        return value.split(ARRAY_DELIMITER);
      }
      return value;
    }
    case "timerange": {
      if (Array.isArray(value)) {
        if (isArrayOfDates(value)) {
          return value.map((date) => date.getTime()).join(RANGE_DELIMITER);
        }
        return value.join(RANGE_DELIMITER);
      }
      if (value instanceof Date) {
        return value.getTime();
      }
      return value;
    }
    default: {
      return value;
    }
  }
}

export function notEmpty<TValue>(
  value: TValue | null | undefined,
): value is TValue {
  return value !== null && value !== undefined;
}

/**
 * Tokenize input string, respecting quoted values
 *
 * Examples:
 * - `name:john regions:ams` → [["name", "john"], ["regions", "ams"]]
 * - `name:"john doe" regions:ams` → [["name", "john doe"], ["regions", "ams"]]
 * - `url:"https://example.com/path with spaces"` → [["url", "https://example.com/path with spaces"]]
 */
export function tokenizeFilterInput(input: string): Array<[string, string]> {
  const results: Array<[string, string]> = [];
  const trimmed = input.trim();

  // Regex to match: key:"quoted value" or key:unquoted_value
  // This handles:
  // - key:"value with spaces"
  // - key:'value with spaces' (single quotes)
  // - key:valueWithoutSpaces
  const regex = /(\w+):(?:"([^"]*)"|'([^']*)'|(\S+))/g;

  let match;
  while ((match = regex.exec(trimmed)) !== null) {
    const key = match[1];
    // Value is in group 2 (double quotes), group 3 (single quotes), or group 4 (unquoted)
    const value = match[2] ?? match[3] ?? match[4];
    if (key && value !== undefined) {
      results.push([key, value]);
    }
  }

  return results;
}

/**
 * Serialize a value, adding quotes if it contains spaces
 */
export function serializeFilterValue(value: string): string {
  if (value.includes(" ")) {
    return `"${value}"`;
  }
  return value;
}

/**
 * Schema-based column filters parser for BYOS
 *
 * This parser works with the new schema system instead of nuqs ParserBuilder.
 */
export function columnFiltersParserFromSchema<TData>({
  schema,
  filterFields,
}: {
  schema: SchemaDefinition;
  filterFields: DataTableFilterField<TData>[];
}) {
  return {
    parse: (inputValue: string) => {
      // Use tokenizer that respects quoted values
      const tokens = tokenizeFilterInput(inputValue);
      const values = tokens.reduce(
        (prev, [name, value]) => {
          prev[name] = value;
          return prev;
        },
        {} as Record<string, string>,
      );

      const searchParams = Object.entries(values).reduce(
        (prev, [key, value]) => {
          const fieldBuilder = schema[key] as FieldBuilder<unknown> | undefined;
          if (!fieldBuilder) return prev;

          const parsed = fieldBuilder._config.parse(value);
          if (parsed !== null) {
            prev[key] = parsed;
          }
          return prev;
        },
        {} as Record<string, unknown>,
      );

      return searchParams;
    },
    serialize: (columnFilters: ColumnFiltersState) => {
      const values = columnFilters.reduce((prev, curr) => {
        const { commandDisabled } = filterFields?.find(
          (field) => curr.id === field.value,
        ) || { commandDisabled: true };
        const fieldBuilder = schema[curr.id] as
          | FieldBuilder<unknown>
          | undefined;

        if (commandDisabled || !fieldBuilder) return prev;

        const serialized = fieldBuilder._config.serialize(curr.value);
        if (!serialized) return prev;

        // Wrap in quotes if value contains spaces
        const quotedValue = serializeFilterValue(serialized);
        return `${prev}${curr.id}:${quotedValue} `;
      }, "");

      return values;
    },
  };
}

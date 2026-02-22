import type { ColumnDescriptor, FilterDescriptor, SchemaJSON } from "./types";

// Unix ms timestamps are 13-digit numbers (> Sep 2001, < Nov 2286)
const UNIX_MS_MIN = 1_000_000_000_000;
const UNIX_MS_MAX = 9_999_999_999_999;

function isIso8601(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}(T[\d:.Z+\-]+)?$/.test(value) &&
    !isNaN(Date.parse(value))
  );
}

function isUnixMs(value: number): boolean {
  return (
    Number.isInteger(value) && value >= UNIX_MS_MIN && value <= UNIX_MS_MAX
  );
}

/** Convert camelCase or snake_case key to a Title Case label. */
function keyToLabel(key: string): string {
  let label = key.replace(/_/g, " ");
  label = label.replace(/([a-z])([A-Z])/g, "$1 $2");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function makeDescriptor(
  key: string,
  label: string,
  dataType: ColumnDescriptor["dataType"],
  filter: FilterDescriptor | null,
): ColumnDescriptor {
  const displayMap: Record<string, string> = {
    string: "text",
    number: "number",
    boolean: "boolean",
    timestamp: "timestamp",
    enum: "badge",
    array: "badge",
    record: "text",
  };
  return {
    key,
    label,
    dataType,
    optional: false,
    hidden: false,
    sortable: false,
    display: { type: displayMap[dataType] ?? "text" },
    filter,
    sheet: null,
  };
}

function inferColDescriptor(key: string, values: unknown[]): ColumnDescriptor {
  const label = keyToLabel(key);
  const nonNull = values.filter((v) => v !== null && v !== undefined);

  if (nonNull.length === 0) {
    return makeDescriptor(key, label, "string", {
      type: "input",
      defaultOpen: false,
      commandDisabled: false,
    });
  }

  // Timestamp: ISO 8601 strings
  if (nonNull.every((v) => typeof v === "string" && isIso8601(v as string))) {
    return makeDescriptor(key, label, "timestamp", {
      type: "timerange",
      defaultOpen: false,
      commandDisabled: false,
    });
  }

  // Timestamp: Unix ms numbers
  if (nonNull.every((v) => typeof v === "number" && isUnixMs(v as number))) {
    return makeDescriptor(key, label, "timestamp", {
      type: "timerange",
      defaultOpen: false,
      commandDisabled: false,
    });
  }

  // Boolean
  if (nonNull.every((v) => v === true || v === false)) {
    return makeDescriptor(key, label, "boolean", {
      type: "checkbox",
      defaultOpen: false,
      commandDisabled: false,
    });
  }

  // Number
  if (nonNull.every((v) => typeof v === "number")) {
    const nums = nonNull as number[];
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    const filter: FilterDescriptor =
      min !== max
        ? {
            type: "slider",
            defaultOpen: false,
            commandDisabled: false,
            min,
            max,
          }
        : { type: "input", defaultOpen: false, commandDisabled: false };
    return {
      ...makeDescriptor(key, label, "number", filter),
      display: { type: "number" },
    };
  }

  // Array
  if (nonNull.every((v) => Array.isArray(v))) {
    const allItems = (nonNull as unknown[][])
      .flat()
      .filter((v) => v !== null && v !== undefined);
    const allStrings =
      allItems.length > 0 && allItems.every((v) => typeof v === "string");
    if (allStrings) {
      const distinct = new Set(allItems as string[]);
      if (distinct.size <= 10) {
        const enumValues = Array.from(distinct);
        return {
          key,
          label,
          dataType: "array",
          arrayItemType: { dataType: "enum", enumValues },
          optional: false,
          hidden: false,
          sortable: false,
          display: { type: "badge" },
          filter: {
            type: "checkbox",
            defaultOpen: false,
            commandDisabled: false,
            options: enumValues.map((v) => ({ label: v, value: v })),
          },
          sheet: null,
        };
      }
    }
    // Non-enum array: not filterable
    return makeDescriptor(key, label, "array", null);
  }

  // Record (plain object, non-array)
  if (nonNull.every((v) => typeof v === "object" && !Array.isArray(v))) {
    return makeDescriptor(key, label, "record", null);
  }

  // String: check if enum (≤ 10 distinct values)
  if (nonNull.every((v) => typeof v === "string")) {
    const distinct = new Set(nonNull as string[]);
    if (distinct.size <= 10) {
      const enumValues = Array.from(distinct);
      return {
        key,
        label,
        dataType: "enum",
        enumValues,
        optional: false,
        hidden: false,
        sortable: false,
        display: { type: "badge" },
        filter: {
          type: "checkbox",
          defaultOpen: false,
          commandDisabled: false,
          options: enumValues.map((v) => ({ label: v, value: v })),
        },
        sheet: null,
      };
    }
    return makeDescriptor(key, label, "string", {
      type: "input",
      defaultOpen: false,
      commandDisabled: false,
    });
  }

  // Fallback
  return makeDescriptor(key, label, "string", {
    type: "input",
    defaultOpen: false,
    commandDisabled: false,
  });
}

/**
 * Infer a SchemaJSON from an array of plain data objects.
 *
 * Walks all rows, collects per-key values, and infers the best ColKind and
 * FilterType for each column using these heuristics:
 * - `timestamp`: ISO 8601 strings or Unix-ms numbers
 * - `boolean`: all values strictly true/false
 * - `number`: all non-null values are typeof "number"
 * - `enum`: strings with ≤ 10 distinct values across the sample
 * - `array`: values are arrays (item type inferred recursively)
 * - `record`: values are plain objects (non-array)
 * - `string`: fallback
 *
 * Number columns with min ≠ max get a "slider" filter; otherwise "input".
 */
export function inferSchemaFromJSON(data: unknown[]): SchemaJSON {
  if (!Array.isArray(data) || data.length === 0) {
    return { columns: [] };
  }

  // Collect all keys and their values across rows (preserving insertion order)
  const keyValues = new Map<string, unknown[]>();

  for (const row of data) {
    if (typeof row !== "object" || row === null || Array.isArray(row)) continue;
    for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
      if (!keyValues.has(key)) keyValues.set(key, []);
      keyValues.get(key)!.push(value);
    }
  }

  const columns = Array.from(keyValues.entries()).map(([key, values]) =>
    inferColDescriptor(key, values),
  );

  return { columns };
}

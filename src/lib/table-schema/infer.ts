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

/** Convert camelCase, snake_case, or kebab-case key to a human-readable label. */
function keyToLabel(key: string): string {
  let label = key.replace(/[-_]/g, " ");
  label = label.replace(/([a-z])([A-Z])/g, "$1 $2");
  return label.replace(/\b\w/g, (c) => c.toUpperCase());
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
    sheet: {},
  };
}

/** Split a key into lowercase words, handling camelCase, snake_case, and kebab-case. */
function keyToWords(key: string): string[] {
  return key
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .split(/[-_]/)
    .map((w) => w.toLowerCase())
    .filter(Boolean);
}

const ID_WORDS = new Set(["id", "uuid", "hash", "token", "key"]);
const CODE_WORDS = new Set(["path", "url", "uri", "endpoint", "route", "host"]);
const LATENCY_WORDS = new Set(["latency", "duration", "elapsed"]);
const SIZE_WORDS = new Set(["size", "bytes", "length"]);
const LEVEL_WORDS = new Set(["level", "severity"]);
const TRACE_ID_WORDS = new Set(["trace", "span", "request"]);

/** Post-process an inferred descriptor with smart display/config heuristics. */
function enhanceDescriptor(descriptor: ColumnDescriptor): ColumnDescriptor {
  const words = keyToWords(descriptor.key);
  const joined = words.join("");
  const d = { ...descriptor };

  const hasIdWord = words.some((w) => ID_WORDS.has(w));
  const hasCodeWord = words.some((w) => CODE_WORDS.has(w));
  const hasLatencyWord =
    words.some((w) => LATENCY_WORDS.has(w)) || joined.includes("responsetime");
  const hasSizeWord = words.some((w) => SIZE_WORDS.has(w));
  const hasLevelWord = words.some((w) => LEVEL_WORDS.has(w));
  const isTraceId = hasIdWord && words.some((w) => TRACE_ID_WORDS.has(w));

  // ID-like columns → code display, not sortable
  if (hasIdWord) {
    d.display = { type: "code" };
    d.sortable = false;
    // Trace/span/request IDs → hidden, not filterable (matches col.presets.traceId())
    if (isTraceId) {
      d.hidden = true;
      d.filter = null;
    }
  }
  // Path/URL-like columns → code display
  else if (hasCodeWord) {
    d.display = { type: "code" };
  }
  // Latency-like number columns → number with ms unit, sortable
  else if (hasLatencyWord && d.dataType === "number") {
    d.display = { type: "number", unit: "ms" };
    d.sortable = true;
  }
  // Size-like number columns → number with B unit, sortable
  else if (hasSizeWord && d.dataType === "number") {
    d.display = { type: "number", unit: "B" };
    d.sortable = true;
  }

  // Sortable defaults by type (unless ID-like)
  if (!hasIdWord) {
    if (d.dataType === "timestamp" || d.dataType === "number") {
      d.sortable = true;
    }
  }

  // Log level / severity enums: expand filter by default (matches col.presets.logLevel())
  if (hasLevelWord && d.dataType === "enum" && d.filter) {
    d.filter = { ...d.filter, defaultOpen: true };
  }

  // Column sizing defaults
  const sizeDefaults: Record<string, number> = {
    boolean: 100,
    timestamp: 180,
    number: 120,
    enum: 130,
  };
  if (sizeDefaults[d.dataType] !== undefined) {
    d.size = sizeDefaults[d.dataType];
  }

  return d;
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
      commandDisabled: true,
    });
  }

  // Timestamp: Unix ms numbers
  if (nonNull.every((v) => typeof v === "number" && isUnixMs(v as number))) {
    return makeDescriptor(key, label, "timestamp", {
      type: "timerange",
      defaultOpen: false,
      commandDisabled: true,
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
          sheet: {},
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
        sheet: {},
      };
    }
    return makeDescriptor(key, label, "string", {
      type: "input",
      defaultOpen: false,
      commandDisabled: false,
    });
  }

  // Fallback: mixed or unrecognised types — warn and treat as string
  const types = [
    ...new Set(nonNull.map((v) => (Array.isArray(v) ? "array" : typeof v))),
  ];
  console.warn(
    `[inferSchemaFromJSON] Column "${key}" has mixed or ambiguous types (${types.join(", ")}). ` +
      `Falling back to string input filter.`,
  );
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
    enhanceDescriptor(inferColDescriptor(key, values)),
  );

  return { columns };
}

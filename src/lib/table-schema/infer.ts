import type {
  ColumnDescriptor,
  FilterDescriptor,
  SchemaJSON,
  SerializableDisplayConfig,
} from "./types";

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

function displayForDataType(
  dataType: ColumnDescriptor["dataType"],
): SerializableDisplayConfig {
  switch (dataType) {
    case "number":
      return { type: "number" };
    case "boolean":
      return { type: "boolean" };
    case "timestamp":
      return { type: "timestamp" };
    case "enum":
    case "array":
      return { type: "badge" };
    case "string":
    case "record":
    case "select":
    default:
      return { type: "text" };
  }
}

function makeDescriptor(
  key: string,
  label: string,
  dataType: ColumnDescriptor["dataType"],
  filter: FilterDescriptor | null,
): ColumnDescriptor {
  return {
    key,
    label,
    dataType,
    optional: false,
    hidden: false,
    sortable: false,
    display: displayForDataType(dataType),
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
const CODE_WORDS = new Set([
  "path",
  "url",
  "uri",
  "endpoint",
  "route",
  "host",
  "link",
  "href",
  "website",
]);
const LATENCY_WORDS = new Set([
  "latency",
  "duration",
  "elapsed",
  "delay",
  "wait",
  "ttfb",
  "rtt",
  "ping",
]);
const SIZE_WORDS = new Set(["size", "bytes", "length"]);
const LEVEL_WORDS = new Set(["level", "severity"]);
const TRACE_ID_WORDS = new Set(["trace", "span", "request"]);
const FAVORITE_WORDS = new Set(["favorite", "starred", "bookmarked", "pinned"]);
const EMAIL_WORDS = new Set(["email", "mail"]);
const STATUS_WORDS = new Set(["status", "state"]);
const PERCENTAGE_WORDS = new Set([
  "percent",
  "pct",
  "progress",
  "completion",
  "accuracy",
  "confidence",
]);
const RESOURCE_WORDS = new Set([
  "cpu",
  "memory",
  "mem",
  "usage",
  "utilization",
  "load",
  "disk",
  "gpu",
]);
const TEMPERATURE_WORDS = new Set(["temp", "temperature"]);
const RATE_WORDS = new Set([
  "rate",
  "throughput",
  "rps",
  "qps",
  "tps",
  "ops",
  "bandwidth",
]);
/** Suffixes that imply a time-based unit when the column is numeric. */
const TIME_UNIT_SUFFIXES = new Set(["ms", "millis"]);
/** Suffixes that imply a percentage when the column is numeric. */
const PERCENT_UNIT_SUFFIXES = new Set(["pct", "percent"]);

/** Semantic color mapping for status-like enum values. */
const STATUS_COLORS: Record<string, string> = {
  active: "#22c55e",
  completed: "#22c55e",
  success: "#22c55e",
  published: "#22c55e",
  approved: "#22c55e",
  pending: "#f59e0b",
  draft: "#f59e0b",
  inactive: "#f59e0b",
  paused: "#f59e0b",
  error: "#ef4444",
  failed: "#ef4444",
  rejected: "#ef4444",
  cancelled: "#ef4444",
  archived: "#6b7280",
  deleted: "#6b7280",
  disabled: "#6b7280",
};

/** Neutral palette for enum values without semantic meaning. */
const NEUTRAL_PALETTE = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#06b6d4",
  "#84cc16",
  "#eab308",
  "#ef4444",
  "#64748b",
];

/** Generate a colorMap for enum values, using semantic colors where possible. */
function generateColorMap(values: readonly string[]): Record<string, string> {
  const colorMap: Record<string, string> = {};
  let neutralIdx = 0;
  for (const value of values) {
    const lower = value.toLowerCase();
    if (STATUS_COLORS[lower]) {
      colorMap[value] = STATUS_COLORS[lower];
    } else {
      colorMap[value] = NEUTRAL_PALETTE[neutralIdx % NEUTRAL_PALETTE.length]!;
      neutralIdx++;
    }
  }
  return colorMap;
}

/** Post-process an inferred descriptor with smart display/config heuristics. */
function enhanceDescriptor(descriptor: ColumnDescriptor): ColumnDescriptor {
  const words = keyToWords(descriptor.key);
  const joined = words.join("");
  const d = { ...descriptor };

  const lastWord = words[words.length - 1];

  const hasIdWord = words.some((w) => ID_WORDS.has(w));
  const hasCodeWord = words.some((w) => CODE_WORDS.has(w));
  const hasLatencyWord =
    words.some((w) => LATENCY_WORDS.has(w)) || joined.includes("responsetime");
  const hasSizeWord = words.some((w) => SIZE_WORDS.has(w));
  const hasLevelWord = words.some((w) => LEVEL_WORDS.has(w));
  const isTraceId = hasIdWord && words.some((w) => TRACE_ID_WORDS.has(w));
  const hasFavoriteWord = words.some((w) => FAVORITE_WORDS.has(w));
  const hasEmailWord = words.some((w) => EMAIL_WORDS.has(w));
  const hasStatusWord = words.some((w) => STATUS_WORDS.has(w));
  const hasPercentageWord = words.some((w) => PERCENTAGE_WORDS.has(w));
  const hasResourceWord = words.some((w) => RESOURCE_WORDS.has(w));
  const hasTemperatureWord = words.some((w) => TEMPERATURE_WORDS.has(w));
  const hasRateWord = words.some((w) => RATE_WORDS.has(w));
  const hasTimeSuffix = lastWord != null && TIME_UNIT_SUFFIXES.has(lastWord);
  const hasPercentSuffix =
    lastWord != null && PERCENT_UNIT_SUFFIXES.has(lastWord);

  // Extract data min/max from slider filter (already computed during inference)
  const dataMin = d.filter?.min ?? 0;
  const dataMax = d.filter?.max ?? 100;

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
  // Favorite/starred booleans → star display, hide column header
  else if (hasFavoriteWord && d.dataType === "boolean") {
    d.display = { type: "star" };
    d.hideHeader = true;
  }
  // Email columns → code display
  else if (hasEmailWord && d.dataType === "string") {
    d.display = { type: "code" };
  }
  // Path/URL-like columns → code display
  else if (hasCodeWord) {
    d.display = { type: "code" };
  }
  // Latency-like number columns → bar with ms unit, sortable
  else if (hasLatencyWord && d.dataType === "number") {
    d.display = { type: "bar", min: 0, max: dataMax, unit: "ms" };
    d.sortable = true;
  }
  // Size-like number columns → number with B unit, sortable
  else if (hasSizeWord && d.dataType === "number") {
    d.display = { type: "number", unit: "B" };
    d.sortable = true;
  }
  // Percentage-like number columns → heatmap 0–100
  else if (hasPercentageWord && d.dataType === "number") {
    d.display = { type: "heatmap", min: 0, max: 100 };
    d.sortable = true;
  }
  // Resource utilization columns → heatmap 0–100
  else if (hasResourceWord && d.dataType === "number") {
    d.display = { type: "heatmap", min: 0, max: 100 };
    d.sortable = true;
  }
  // Temperature columns → heatmap with actual data range
  else if (hasTemperatureWord && d.dataType === "number") {
    d.display = { type: "heatmap", min: dataMin, max: dataMax };
    d.sortable = true;
  }
  // Rate/throughput columns → bar with 0 to actual max
  else if (hasRateWord && d.dataType === "number") {
    d.display = { type: "bar", min: 0, max: dataMax };
    d.sortable = true;
  }
  // Suffix detection: *_ms, *Millis → bar with ms unit
  else if (hasTimeSuffix && d.dataType === "number") {
    d.display = { type: "bar", min: 0, max: dataMax, unit: "ms" };
    d.sortable = true;
  }
  // Suffix detection: *_pct, *Percent → heatmap 0–100
  else if (hasPercentSuffix && d.dataType === "number") {
    d.display = { type: "heatmap", min: 0, max: 100 };
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

  // Status/state enums → semantic colorMap on badge display
  if (hasStatusWord && d.dataType === "enum" && d.enumValues) {
    d.display = { type: "badge", colorMap: generateColorMap(d.enumValues) };
  }

  // Column sizing defaults
  const sizeDefaults: Record<string, number> = {
    boolean: 100,
    timestamp: 220,
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

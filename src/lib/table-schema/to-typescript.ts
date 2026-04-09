import type { ColumnDescriptor, SchemaJSON } from "./types";

interface PresetMatch {
  factory: string;
  skipDisplay: boolean;
  skipFilter: boolean;
  skipSortable: boolean;
}

/**
 * Detect whether a descriptor matches a known `col.presets.*` pattern.
 * Returns the preset factory call and which method chain steps it already covers.
 */
function detectPreset(c: ColumnDescriptor): PresetMatch | null {
  // traceId: string + code display + not filterable
  if (
    c.dataType === "string" &&
    c.display.type === "code" &&
    c.filter === null
  ) {
    return {
      factory: "col.presets.traceId()",
      skipDisplay: true,
      skipFilter: true,
      skipSortable: false,
    };
  }

  // timestamp + sortable → col.presets.timestamp()
  if (c.dataType === "timestamp" && c.sortable) {
    return {
      factory: "col.presets.timestamp()",
      skipDisplay: true,
      skipFilter: true,
      skipSortable: true,
    };
  }

  // duration: number + slider + number display → col.presets.duration(unit?, bounds?)
  if (
    c.dataType === "number" &&
    c.filter?.type === "slider" &&
    c.display.type === "number"
  ) {
    const unit = c.display.unit;
    const min = c.filter.min ?? 0;
    const max = c.filter.max ?? 100;
    const defaultBounds = min === 0 && max === 5000;
    const args: string[] = [];
    if (unit) {
      args.push(JSON.stringify(unit));
      if (!defaultBounds) args.push(`{ min: ${min}, max: ${max} }`);
    } else if (!defaultBounds) {
      args.push(`undefined, { min: ${min}, max: ${max} }`);
    }
    return {
      factory: `col.presets.duration(${args.join(", ")})`,
      skipDisplay: true,
      skipFilter: true,
      skipSortable: false,
    };
  }

  // logLevel: enum + badge + checkbox + defaultOpen
  if (
    c.dataType === "enum" &&
    c.enumValues &&
    c.filter?.type === "checkbox" &&
    c.filter?.defaultOpen &&
    c.display.type === "badge"
  ) {
    const vals = c.enumValues.map((v) => JSON.stringify(v)).join(", ");
    return {
      factory: `col.presets.logLevel([${vals}])`,
      skipDisplay: true,
      skipFilter: true,
      skipSortable: false,
    };
  }

  // httpStatus: number + number display + checkbox with all-numeric options
  if (
    c.dataType === "number" &&
    c.display.type === "number" &&
    c.filter?.type === "checkbox" &&
    c.filter?.options?.every((o) => typeof o.value === "number")
  ) {
    const codes = c.filter.options!.map((o) => o.value);
    return {
      factory: `col.presets.httpStatus([${codes.join(", ")}])`,
      skipDisplay: true,
      skipFilter: true,
      skipSortable: false,
    };
  }

  // httpMethod: enum + text + checkbox + !defaultOpen
  if (
    c.dataType === "enum" &&
    c.enumValues &&
    c.filter?.type === "checkbox" &&
    !c.filter?.defaultOpen &&
    c.display.type === "text"
  ) {
    const vals = c.enumValues.map((v) => JSON.stringify(v)).join(", ");
    return {
      factory: `col.presets.httpMethod([${vals}])`,
      skipDisplay: true,
      skipFilter: true,
      skipSortable: false,
    };
  }

  return null;
}

/**
 * Build the `col.*` factory call and method chain for one column descriptor.
 */
function buildChain(c: ColumnDescriptor): string {
  const parts: string[] = [];
  let skipDisplay = false;
  let skipFilter = false;
  let skipSortable = false;

  // 1. Factory (with preset detection)
  const preset = detectPreset(c);
  if (preset) {
    parts.push(preset.factory);
    skipDisplay = preset.skipDisplay;
    skipFilter = preset.skipFilter;
    skipSortable = preset.skipSortable;
  } else if (c.dataType === "enum" && c.enumValues) {
    const vals = c.enumValues.map((v) => JSON.stringify(v)).join(", ");
    parts.push(`col.enum([${vals}])`);
  } else if (
    c.dataType === "array" &&
    c.arrayItemType?.dataType === "enum" &&
    c.arrayItemType.enumValues
  ) {
    const vals = c.arrayItemType.enumValues
      .map((v) => JSON.stringify(v))
      .join(", ");
    parts.push(`col.array(col.enum([${vals}]))`);
  } else {
    parts.push(`col.${c.dataType}()`);
  }

  // 2. .label()
  parts.push(`.label(${JSON.stringify(c.label)})`);

  // 3. .description()
  if (c.description) {
    parts.push(`.description(${JSON.stringify(c.description)})`);
  }

  // 4. .display() — skip if covered by preset (unless colorMap needs emitting)
  if (!skipDisplay) {
    const display = c.display;
    const hasColorMap = !!display.colorMap;
    if (display.type === "number" && (display.unit || hasColorMap)) {
      const opts: Record<string, unknown> = {};
      if (display.unit) opts.unit = display.unit;
      if (hasColorMap) opts.colorMap = display.colorMap;
      parts.push(`.display("number", ${JSON.stringify(opts)})`);
    } else if (display.type === "bar") {
      const opts: Record<string, unknown> = {
        min: display.min,
        max: display.max,
      };
      if (display.unit) opts.unit = display.unit;
      if (hasColorMap) opts.colorMap = display.colorMap;
      parts.push(`.display("bar", ${JSON.stringify(opts)})`);
    } else if (display.type === "heatmap") {
      const opts: Record<string, unknown> = {
        min: display.min,
        max: display.max,
      };
      if (display.color) opts.color = display.color;
      if (hasColorMap) opts.colorMap = display.colorMap;
      parts.push(`.display("heatmap", ${JSON.stringify(opts)})`);
    } else if (hasColorMap) {
      parts.push(
        `.display(${JSON.stringify(display.type)}, ${JSON.stringify({ colorMap: display.colorMap })})`,
      );
    } else if (
      display.type !== "text" // "text" is the default for string/record, skip it
    ) {
      parts.push(`.display(${JSON.stringify(display.type)})`);
    }
  } else if (c.display.colorMap) {
    // Preset covers display type, but colorMap still needs to be emitted
    parts.push(
      `.display(${JSON.stringify(c.display.type)}, ${JSON.stringify({ colorMap: c.display.colorMap })})`,
    );
  }

  // 5. .filterable() / .notFilterable() — skip if covered by preset
  if (!skipFilter) {
    if (c.filter === null) {
      parts.push(`.notFilterable()`);
    } else {
      const f = c.filter;
      if (f.type === "slider" && f.min !== undefined && f.max !== undefined) {
        parts.push(`.filterable("slider", { min: ${f.min}, max: ${f.max} })`);
      } else if (f.type === "checkbox") {
        if (f.options && f.options.length > 0) {
          const opts = f.options
            .map(
              (o) =>
                `{ label: ${JSON.stringify(o.label)}, value: ${JSON.stringify(o.value)} }`,
            )
            .join(", ");
          parts.push(`.filterable("checkbox", { options: [${opts}] })`);
        } else {
          parts.push(`.filterable("checkbox")`);
        }
      } else if (f.type === "timerange") {
        parts.push(`.filterable("timerange")`);
      } else {
        parts.push(`.filterable("input")`);
      }

      if (f.defaultOpen) parts.push(`.defaultOpen()`);
      if (f.commandDisabled) parts.push(`.commandDisabled()`);
    }
  } else if (c.filter) {
    // Preset covers the filter, but still emit behavioral flags if set
    if (c.filter.defaultOpen) parts.push(`.defaultOpen()`);
    if (c.filter.commandDisabled) parts.push(`.commandDisabled()`);
  }

  // 6. Structural modifiers
  if (!skipSortable && c.sortable) parts.push(`.sortable()`);
  if (c.hidden) parts.push(`.hidden()`);
  if (c.optional) parts.push(`.optional()`);
  if (c.size !== undefined) parts.push(`.size(${c.size})`);

  // 7. .sheet()
  if (c.sheet !== null) {
    const sheetArgs: string[] = [];
    if (c.sheet.label)
      sheetArgs.push(`label: ${JSON.stringify(c.sheet.label)}`);
    if (c.sheet.className)
      sheetArgs.push(`className: ${JSON.stringify(c.sheet.className)}`);
    if (c.sheet.skeletonClassName)
      sheetArgs.push(
        `skeletonClassName: ${JSON.stringify(c.sheet.skeletonClassName)}`,
      );
    parts.push(
      sheetArgs.length > 0 ? `.sheet({ ${sheetArgs.join(", ")} })` : `.sheet()`,
    );
  }

  return parts.join("\n    ");
}

/**
 * Convert a `SchemaJSON` descriptor to a `createTableSchema(...)` TypeScript
 * source code string.
 *
 * The output is ready to copy-paste into a project that imports from
 * `@/lib/table-schema`.
 *
 * @example
 * ```ts
 * const ts = schemaToTypeScript(tableSchema.toJSON());
 * // → 'import { createTableSchema, col } from "@/lib/table-schema"; ...'
 * ```
 */
export function schemaToTypeScript(json: SchemaJSON): string {
  const lines: string[] = [
    'import { createTableSchema, col } from "@/lib/table-schema";',
    "",
    "export const schema = createTableSchema({",
  ];

  for (const descriptor of json.columns) {
    const chain = buildChain(descriptor);
    lines.push(`  ${descriptor.key}: ${chain},`);
  }

  lines.push("});");
  return lines.join("\n");
}

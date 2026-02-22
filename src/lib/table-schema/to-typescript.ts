import type { ColumnDescriptor, SchemaJSON } from "./types";

/**
 * Build the `col.*` factory call and method chain for one column descriptor.
 */
function buildChain(c: ColumnDescriptor): string {
  const parts: string[] = [];

  // 1. Factory
  if (c.dataType === "enum" && c.enumValues) {
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

  // 4. .display()
  const dt = c.display.type;
  if (dt === "number" && c.display.unit) {
    parts.push(
      `.display("number", { unit: ${JSON.stringify(c.display.unit)} })`,
    );
  } else if (
    dt !== "text" // "text" is the default for string/record, skip it
  ) {
    parts.push(`.display(${JSON.stringify(dt)})`);
  }

  // 5. .filterable() / .notFilterable()
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

  // 6. Structural modifiers
  if (c.sortable) parts.push(`.sortable()`);
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

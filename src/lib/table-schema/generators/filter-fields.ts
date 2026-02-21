import type { DataTableFilterField } from "@/components/data-table/types";
import type { TableSchemaDefinition } from "../types";

/**
 * Generate DataTableFilterField[] from a table schema definition.
 *
 * Only includes fields where filter !== null.
 * Order follows schema definition order (JS object key insertion order).
 *
 * Options for checkbox fields are auto-derived from col.enum(values) or
 * col.boolean() if not explicitly provided via filterable("checkbox", { options }).
 */
export function generateFilterFields<TData>(
  schema: TableSchemaDefinition,
): DataTableFilterField<TData>[] {
  const result: DataTableFilterField<TData>[] = [];

  for (const [key, builder] of Object.entries(schema)) {
    const config = builder._config;
    if (!config.filter) continue;

    const { filter, label, kind, enumValues, arrayItem } = config;

    const base = {
      label,
      value: key as keyof TData,
      defaultOpen: filter.defaultOpen || undefined,
      commandDisabled: filter.commandDisabled || undefined,
    };

    switch (filter.type) {
      case "input": {
        result.push({ ...base, type: "input" });
        break;
      }
      case "timerange": {
        result.push({
          ...base,
          type: "timerange",
          presets: filter.presets,
        });
        break;
      }
      case "checkbox": {
        // Derive options if not explicitly provided
        let options = filter.options;
        if (!options) {
          if (kind === "enum" && enumValues) {
            options = enumValues.map((v) => ({ label: v, value: v }));
          } else if (kind === "boolean") {
            options = [
              { label: "Yes", value: true },
              { label: "No", value: false },
            ];
          } else if (
            kind === "array" &&
            arrayItem?.kind === "enum" &&
            arrayItem.enumValues
          ) {
            options = arrayItem.enumValues.map((v) => ({ label: v, value: v }));
          }
        }
        result.push({
          ...base,
          type: "checkbox",
          options,
          component: filter.component,
        });
        break;
      }
      case "slider": {
        result.push({
          ...base,
          type: "slider",
          min: filter.min ?? 0,
          max: filter.max ?? 100,
        });
        break;
      }
    }
  }

  return result;
}

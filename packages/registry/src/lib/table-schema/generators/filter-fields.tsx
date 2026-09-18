// Imported from its file, not the cell barrel: this generator runs on the
// server too (the filter schema reads it), and the barrel drags in cells that
// use client-only hooks.
import { DataTableCellLevelIndicator } from "@dtf/registry/components/data-table/data-table-cell/data-table-cell-level-indicator";
import type {
  DataTableFilterField,
  Option,
} from "@dtf/registry/components/data-table/types";
import type { JSX } from "react";
import { fromPresetDescriptor, resolveColumns } from "../col";
import type { ResolvedColumn, TableSchemaDefinition } from "../types";

/**
 * The checkbox option a display picks when the column supplied no
 * `component` of its own. A `level-indicator` column shows the same dot it
 * renders in its cells, so the filter sidebar reads like the table — which
 * is why it is limited to the kinds whose cells draw the dot (`renderCell`
 * falls back to plain text for anything but a string).
 */
function defaultFilterComponent(
  config: ResolvedColumn,
): ((props: Option) => JSX.Element | null) | undefined {
  if (config.display.type !== "level-indicator") return undefined;
  if (config.kind !== "enum" && config.kind !== "string") return undefined;
  const colorMap = config.display.colorMap;
  return function LevelOption({ label, value }: Option) {
    return (
      <DataTableCellLevelIndicator
        value={String(value)}
        label={label}
        color={colorMap?.[String(value)]}
        showLabel
      />
    );
  };
}

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

  for (const config of resolveColumns(schema)) {
    const { key, filter, label, kind } = config;
    if (!filter) continue;

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
          presets: filter.presets?.map(fromPresetDescriptor),
        });
        break;
      }
      case "checkbox": {
        // Derive options if not explicitly provided
        let options = filter.options;
        if (!options) {
          if (config.kind === "enum") {
            options = config.enumValues.map((v) => ({ label: v, value: v }));
          } else if (kind === "boolean") {
            options = [
              { label: "Yes", value: true },
              { label: "No", value: false },
            ];
          } else if (
            config.kind === "array" &&
            config.arrayItem.kind === "enum"
          ) {
            options = config.arrayItem.enumValues.map((v) => ({
              label: v,
              value: v,
            }));
          }
        }
        result.push({
          ...base,
          type: "checkbox",
          options,
          component:
            config.renderers.filterComponent ?? defaultFilterComponent(config),
        });
        break;
      }
      case "slider": {
        const displayUnit =
          "unit" in config.display ? config.display.unit : undefined;
        result.push({
          ...base,
          type: "slider",
          min: filter.min ?? 0,
          max: filter.max ?? 100,
          unit: filter.unit ?? displayUnit,
        });
        break;
      }
    }
  }

  return result;
}

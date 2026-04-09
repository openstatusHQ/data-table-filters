"use client";

import {
  DataTableCellBadge,
  DataTableCellBar,
  DataTableCellBoolean,
  DataTableCellCode,
  DataTableCellHeatmap,
  DataTableCellLevelIndicator,
  DataTableCellNumber,
  DataTableCellStar,
  DataTableCellStatusCode,
  DataTableCellText,
  DataTableCellTimestamp,
} from "@/components/data-table/data-table-cell";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { Checkbox } from "@/components/ui/checkbox";
import type { ColumnDef } from "@tanstack/react-table";
import type { JSX } from "react";
import type { ColConfig, DisplayConfig, TableSchemaDefinition } from "../types";

/**
 * Derive the TanStack Table filterFn name from a column config.
 *
 * Custom filterFns (arrSome, inDateRange) must be registered on the table:
 *   filterFns: { inDateRange, arrSome }  // from src/lib/table/filterfns.ts
 */
function getFilterFn(config: ColConfig): string | undefined {
  if (!config.filter) return undefined;

  const { kind, filter, arrayItem } = config;

  switch (filter.type) {
    case "timerange":
      return "inDateRange"; // custom — must be registered
    case "slider":
      return "inNumberRange"; // TanStack built-in
    case "input":
      return "includesString"; // TanStack built-in; works for strings and numbers (via toString)
    case "checkbox":
      // Array columns use arrIncludesSome (checks row's array for filter values)
      if (kind === "array") return "arrIncludesSome"; // TanStack built-in
      // Single-value columns use arrSome (checks if row value is in filter array)
      return "arrSome"; // custom — must be registered
  }
}

/**
 * Render the cell based on the display config.
 */
function renderCell(
  display: DisplayConfig,
  value: unknown,
  row: unknown,
): JSX.Element | null {
  const fallback = <DataTableCellText value={String(value ?? "")} />;
  const colorMap = display.colorMap;
  switch (display.type) {
    case "text": {
      const hex = colorMap?.[String(value)];
      return typeof value === "string" || typeof value === "number" ? (
        <DataTableCellText value={value} color={hex} />
      ) : (
        fallback
      );
    }
    case "code": {
      const hex = colorMap?.[String(value)];
      return typeof value === "string" || typeof value === "number" ? (
        <DataTableCellCode value={value} color={hex} />
      ) : (
        fallback
      );
    }
    case "number": {
      const hex = colorMap?.[String(value)];
      return typeof value === "number" ? (
        <DataTableCellNumber value={value} unit={display.unit} color={hex} />
      ) : (
        fallback
      );
    }
    case "bar": {
      return typeof value === "number" ? (
        <DataTableCellBar
          value={value}
          min={display.min}
          max={display.max}
          unit={display.unit}
          color={colorMap?.[String(value)]}
        />
      ) : (
        fallback
      );
    }
    case "heatmap": {
      return typeof value === "number" ? (
        <DataTableCellHeatmap
          value={value}
          min={display.min}
          max={display.max}
          color={display.color}
        />
      ) : (
        fallback
      );
    }
    case "timestamp": {
      const hex = colorMap?.[String(value)];
      return value instanceof Date ||
        typeof value === "string" ||
        typeof value === "number" ? (
        <DataTableCellTimestamp date={value} color={hex} />
      ) : (
        fallback
      );
    }
    case "badge": {
      if (Array.isArray(value)) {
        return (
          <div className="flex-no-wrap flex gap-1">
            {value.map((item, i) => (
              <DataTableCellBadge
                key={i}
                value={item}
                color={colorMap?.[String(item)]}
              />
            ))}
          </div>
        );
      }
      const hex = colorMap?.[String(value)];
      return typeof value === "string" || typeof value === "number" ? (
        <DataTableCellBadge value={value} color={hex} />
      ) : (
        fallback
      );
    }
    case "boolean": {
      const hex = colorMap?.[String(value)];
      return typeof value === "boolean" ? (
        <DataTableCellBoolean value={value} color={hex} />
      ) : (
        fallback
      );
    }
    case "star": {
      return typeof value === "boolean" ? (
        <DataTableCellStar value={value} />
      ) : (
        fallback
      );
    }
    case "status-code": {
      const hex = colorMap?.[String(value)];
      return typeof value === "number" ? (
        <DataTableCellStatusCode value={value} color={hex} />
      ) : (
        fallback
      );
    }
    case "level-indicator": {
      const hex = colorMap?.[String(value)];
      return typeof value === "string" ? (
        <DataTableCellLevelIndicator value={value} color={hex} />
      ) : (
        fallback
      );
    }
    case "custom":
      return display.cell(value, row);
  }
}

/**
 * Generate ColumnDef[] from a table schema definition.
 *
 * Rules:
 * - Dotted keys (e.g. "timing.dns") → id + accessorFn
 * - Non-dotted keys → accessorKey
 * - Sortable columns get DataTableColumnHeader; others get a plain string header
 * - filterFn is derived from col kind + filter type
 * - Cell renders via built-in display components or the "custom" cell function
 * - meta.label is always set; meta.hidden reflects .hidden() calls
 *
 * The consuming component must register custom filterFns:
 *   filterFns: { inDateRange, arrSome }
 *
 * Composite/virtual columns that span multiple fields must be appended manually:
 * @example
 * ```ts
 * const columns = [
 *   ...generateColumns(tableSchema),
 *   { id: "timing", header: ..., cell: ..., size: 130 },
 * ];
 * ```
 */
export function generateColumns<TData>(
  schema: TableSchemaDefinition,
): ColumnDef<TData>[] {
  return Object.entries(schema).map(([key, builder]) => {
    const config = builder._config;

    // Select column — checkbox header + cell
    if (config.kind === "select") {
      return {
        id: key,
        header: ({ table }) => (
          <div className="flex items-center justify-center">
            <Checkbox
              checked={
                table.getIsAllPageRowsSelected() ||
                (table.getIsSomePageRowsSelected() && "indeterminate")
              }
              onCheckedChange={(value) =>
                table.toggleAllPageRowsSelected(!!value)
              }
              aria-label="Select all"
              className="shadow-none"
            />
          </div>
        ),
        cell: ({ row }) => (
          <div
            className="flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(value) => row.toggleSelected(!!value)}
              aria-label="Select row"
              className="shadow-none"
            />
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
        enableResizing: false,
        ...(config.size !== undefined
          ? { size: config.size, minSize: config.size, maxSize: config.size }
          : {}),
        meta: { label: config.label, kind: "select", hidden: false },
      } as ColumnDef<TData>;
    }

    const isDotted = key.includes(".");
    const filterFn = getFilterFn(config);

    const header = config.hideHeader
      ? () => <span className="sr-only">{config.label}</span>
      : config.sortable
        ? ({
            column,
          }: {
            column: Parameters<typeof DataTableColumnHeader>[0]["column"];
          }) => <DataTableColumnHeader column={column} title={config.label} />
        : config.label;

    const cell = ({
      getValue,
      row,
    }: {
      getValue: () => unknown;
      row: { original: TData };
    }) => renderCell(config.display, getValue(), row.original);

    const meta = {
      label: config.label,
      hidden: config.hidden,
      kind: config.kind,
    };

    const base = {
      header,
      cell,
      enableResizing: config.resizable,
      ...(config.enableHiding === false ? { enableHiding: false } : {}),
      ...(filterFn ? { filterFn } : {}),
      ...(config.size !== undefined
        ? {
            size: config.size,
            ...(config.resizable ? {} : { minSize: config.size }),
          }
        : {}),
      meta,
    };

    if (isDotted) {
      return {
        ...base,
        id: key,
        accessorFn: (row: TData) => (row as Record<string, unknown>)[key],
      } as ColumnDef<TData>;
    }

    return {
      ...base,
      accessorKey: key,
    } as ColumnDef<TData>;
  });
}

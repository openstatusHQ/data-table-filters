"use client";

import {
  DataTableCellBadge,
  DataTableCellBoolean,
  DataTableCellCode,
  DataTableCellNumber,
  DataTableCellText,
  DataTableCellTimestamp,
} from "@/components/data-table/data-table-cell";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
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
      if (kind === "string") return "includesString"; // TanStack built-in
      if (kind === "number") return "equals"; // TanStack built-in
      return undefined;
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
  switch (display.type) {
    case "text":
      return <DataTableCellText value={value as string} />;
    case "code":
      return <DataTableCellCode value={value as string} />;
    case "number":
      return (
        <DataTableCellNumber value={value as number} unit={display.unit} />
      );
    case "timestamp":
      return <DataTableCellTimestamp date={value as Date} />;
    case "badge":
      return <DataTableCellBadge value={value as string} />;
    case "boolean":
      return <DataTableCellBoolean value={value as boolean} />;
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
    const isDotted = key.includes(".");
    const filterFn = getFilterFn(config);

    const header = config.sortable
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
    };

    const base = {
      header,
      cell,
      ...(filterFn ? { filterFn } : {}),
      ...(config.size !== undefined
        ? { size: config.size, minSize: config.size }
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

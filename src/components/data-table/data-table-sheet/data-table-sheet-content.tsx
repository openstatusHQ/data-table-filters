"use client";

import {
  DataTableCellBadge,
  DataTableCellBoolean,
  DataTableCellCode,
  DataTableCellLevelIndicator,
  DataTableCellNumber,
  DataTableCellStatusCode,
  DataTableCellTimestamp,
} from "@/components/data-table/data-table-cell";
import { cn } from "@/lib/utils";
import { Table } from "@tanstack/react-table";
import * as React from "react";
import { DataTableFilterField, SheetField } from "../types";
import { DataTableSheetRowAction } from "./data-table-sheet-row-action";
import { SheetDetailsContentSkeleton } from "./data-table-sheet-skeleton";

function renderSheetValue(
  rawValue: unknown,
  display?: { type: string; unit?: string },
): React.ReactNode {
  if (!display) return String(rawValue);
  switch (display.type) {
    case "timestamp":
      return rawValue instanceof Date ||
        typeof rawValue === "string" ||
        typeof rawValue === "number" ? (
        <DataTableCellTimestamp date={rawValue} />
      ) : (
        String(rawValue)
      );
    case "number":
      return typeof rawValue === "number" ? (
        <DataTableCellNumber value={rawValue} unit={display.unit} />
      ) : (
        String(rawValue)
      );
    case "boolean":
      return typeof rawValue === "boolean" ? (
        <DataTableCellBoolean value={rawValue} />
      ) : (
        String(rawValue)
      );
    case "badge":
      return typeof rawValue === "string" || typeof rawValue === "number" ? (
        <DataTableCellBadge value={rawValue} />
      ) : (
        String(rawValue)
      );
    case "code":
      return typeof rawValue === "string" || typeof rawValue === "number" ? (
        <DataTableCellCode value={rawValue} />
      ) : (
        String(rawValue)
      );
    case "status-code":
      return typeof rawValue === "number" ? (
        <DataTableCellStatusCode value={rawValue} />
      ) : (
        String(rawValue)
      );
    case "level-indicator":
      return typeof rawValue === "string" ? (
        <DataTableCellLevelIndicator value={rawValue} />
      ) : (
        String(rawValue)
      );
    case "text":
    default:
      return String(rawValue);
  }
}

interface DataTableSheetContentProps<TData, TMeta>
  extends React.HTMLAttributes<HTMLDListElement> {
  data?: TData;
  table: Table<TData>;
  fields: SheetField<TData, TMeta>[];
  filterFields: DataTableFilterField<TData>[];
  // totalRows: number;
  // filterRows: number;
  // totalRowsFetched: number;
  metadata?: TMeta & {
    totalRows: number;
    filterRows: number;
    totalRowsFetched: number;
  };
}

export function DataTableSheetContent<TData, TMeta>({
  data,
  table,
  className,
  fields,
  filterFields,
  metadata,
  ...props
}: DataTableSheetContentProps<TData, TMeta>) {
  if (!data) return <SheetDetailsContentSkeleton fields={fields} />;

  return (
    <dl className={cn("divide-y", className)} {...props}>
      {fields.map((field) => {
        if (field.condition && !field.condition(data)) return null;

        const Component = field.component;
        const rawValue = data[field.id];
        const rendered = Component ? (
          <Component {...data} metadata={metadata} />
        ) : (
          renderSheetValue(rawValue, field.display)
        );

        return (
          <div key={field.id.toString()}>
            {field.type === "readonly" ? (
              <div
                className={cn(
                  "my-1 flex w-full items-center justify-between gap-4 py-1 text-sm",
                  field.className,
                )}
              >
                <dt className="shrink-0 text-muted-foreground">
                  {field.label}
                </dt>
                <dd className="w-full text-right font-mono">{rendered}</dd>
              </div>
            ) : (
              <DataTableSheetRowAction
                fieldValue={field.id}
                filterFields={filterFields}
                value={
                  typeof rawValue === "boolean" || typeof rawValue === "number"
                    ? rawValue
                    : String(rawValue)
                }
                table={table}
                className={cn(
                  "my-1 flex w-full items-center justify-between gap-4 py-1 text-sm",
                  field.className,
                )}
              >
                <dt className="shrink-0 text-muted-foreground">
                  {field.label}
                </dt>
                <dd className="w-full text-right font-mono">{rendered}</dd>
              </DataTableSheetRowAction>
            )}
          </div>
        );
      })}
    </dl>
  );
}

export const MemoizedDataTableSheetContent = React.memo(
  DataTableSheetContent,
  (prev, next) => {
    // REMINDER: only check if data is the same, rest is useless
    return prev.data === next.data;
  },
) as typeof DataTableSheetContent;

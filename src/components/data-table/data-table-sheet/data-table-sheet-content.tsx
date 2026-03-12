"use client";

import {
  DataTableCellBadge,
  DataTableCellBoolean,
  DataTableCellCode,
  DataTableCellLevelIndicator,
  DataTableCellNumber,
  DataTableCellStatusCode,
  DataTableCellText,
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
  display?: { type: string; unit?: string; colorMap?: Record<string, string> },
): React.ReactNode {
  if (!display) return String(rawValue);
  const colorMap = display.colorMap;
  switch (display.type) {
    case "timestamp": {
      const hex = colorMap?.[String(rawValue)];
      return rawValue instanceof Date ||
        typeof rawValue === "string" ||
        typeof rawValue === "number" ? (
        <DataTableCellTimestamp date={rawValue} color={hex} />
      ) : (
        String(rawValue)
      );
    }
    case "number": {
      const hex = colorMap?.[String(rawValue)];
      return typeof rawValue === "number" ? (
        <DataTableCellNumber value={rawValue} unit={display.unit} color={hex} />
      ) : (
        String(rawValue)
      );
    }
    case "boolean": {
      const hex = colorMap?.[String(rawValue)];
      return typeof rawValue === "boolean" ? (
        <DataTableCellBoolean value={rawValue} color={hex} />
      ) : (
        String(rawValue)
      );
    }
    case "badge": {
      if (Array.isArray(rawValue)) {
        return (
          <div className="flex flex-wrap gap-1">
            {rawValue.map((item, i) => (
              <DataTableCellBadge
                key={i}
                value={item}
                color={colorMap?.[String(item)]}
              />
            ))}
          </div>
        );
      }
      const hex = colorMap?.[String(rawValue)];
      return typeof rawValue === "string" || typeof rawValue === "number" ? (
        <DataTableCellBadge value={rawValue} color={hex} />
      ) : (
        String(rawValue)
      );
    }
    case "code": {
      const hex = colorMap?.[String(rawValue)];
      return typeof rawValue === "string" || typeof rawValue === "number" ? (
        <DataTableCellCode value={rawValue} color={hex} />
      ) : (
        String(rawValue)
      );
    }
    case "status-code": {
      const hex = colorMap?.[String(rawValue)];
      return typeof rawValue === "number" ? (
        <DataTableCellStatusCode value={rawValue} color={hex} />
      ) : (
        String(rawValue)
      );
    }
    case "level-indicator": {
      const hex = colorMap?.[String(rawValue)];
      return typeof rawValue === "string" ? (
        <DataTableCellLevelIndicator value={rawValue} color={hex} />
      ) : (
        String(rawValue)
      );
    }
    case "text": {
      const hex = colorMap?.[String(rawValue)];
      return typeof rawValue === "string" || typeof rawValue === "number" ? (
        <DataTableCellText value={rawValue} color={hex} />
      ) : (
        String(rawValue)
      );
    }
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
                <dt className="text-muted-foreground shrink-0">
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
                <dt className="text-muted-foreground shrink-0">
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

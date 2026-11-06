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
} from "@dtf/registry/components/data-table/data-table-cell";
import type { SerializableDisplayConfig } from "@dtf/registry/lib/table-schema/types";
import type { DataTableFeatures } from "@dtf/registry/lib/table/features";
import { cn } from "@dtf/registry/lib/utils";
import { Table } from "@tanstack/react-table";
import { Minus } from "lucide-react";
import * as React from "react";
import { DataTableFilterField, SheetField } from "../types";
import { DataTableSheetRowAction } from "./data-table-sheet-row-action";
import { SheetDetailsContentSkeleton } from "./data-table-sheet-skeleton";

/**
 * The text for a value no display knows how to draw, or `null` when there is
 * nothing to show.
 *
 * `String(value)` was the fallback everywhere, which is right for a scalar and
 * wrong for the two cases a schema that crossed the wire runs into: a column
 * the endpoint sent as `null` printed the word "null", and a record column
 * whose sheet component did not travel with the manifest printed
 * "[object Object]".
 */
export function sheetValueText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      // Circular, or holding a BigInt: say so rather than fall back to the
      // "[object Object]" this function exists to avoid.
      return "[unserializable]";
    }
  }
  return String(value);
}

function renderSheetFallback(value: unknown): React.ReactNode {
  const text = sheetValueText(value);
  if (text === null) {
    return (
      <Minus
        aria-label="No value"
        className="text-muted-foreground/50 ml-auto size-4"
      />
    );
  }
  if (typeof value === "object" && !(value instanceof Date)) {
    return (
      <pre className="text-left text-xs break-all whitespace-pre-wrap">
        {text}
      </pre>
    );
  }
  return text;
}

function renderSheetValue(
  rawValue: unknown,
  display?: SerializableDisplayConfig,
): React.ReactNode {
  if (!display) return renderSheetFallback(rawValue);
  const colorMap = display.colorMap;
  switch (display.type) {
    case "timestamp": {
      const hex = colorMap?.[String(rawValue)];
      return rawValue instanceof Date ||
        typeof rawValue === "string" ||
        typeof rawValue === "number" ? (
        <DataTableCellTimestamp date={rawValue} color={hex} />
      ) : (
        renderSheetFallback(rawValue)
      );
    }
    case "number": {
      const hex = colorMap?.[String(rawValue)];
      return typeof rawValue === "number" ? (
        <DataTableCellNumber value={rawValue} unit={display.unit} color={hex} />
      ) : (
        renderSheetFallback(rawValue)
      );
    }
    case "bar": {
      return typeof rawValue === "number" ? (
        <DataTableCellBar
          value={rawValue}
          min={display.min ?? 0}
          max={display.max ?? 100}
          unit={display.unit}
          color={colorMap?.[String(rawValue)]}
        />
      ) : (
        renderSheetFallback(rawValue)
      );
    }
    case "heatmap": {
      return typeof rawValue === "number" ? (
        <DataTableCellHeatmap
          value={rawValue}
          min={display.min ?? 0}
          max={display.max ?? 100}
          color={display.color}
        />
      ) : (
        renderSheetFallback(rawValue)
      );
    }
    case "boolean": {
      const hex = colorMap?.[String(rawValue)];
      return typeof rawValue === "boolean" ? (
        <DataTableCellBoolean value={rawValue} color={hex} />
      ) : (
        renderSheetFallback(rawValue)
      );
    }
    case "star": {
      return typeof rawValue === "boolean" ? (
        <DataTableCellStar value={rawValue} />
      ) : (
        renderSheetFallback(rawValue)
      );
    }
    case "badge": {
      if (Array.isArray(rawValue)) {
        return (
          <div className="flex flex-wrap justify-end gap-1">
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
        renderSheetFallback(rawValue)
      );
    }
    case "code": {
      const hex = colorMap?.[String(rawValue)];
      return typeof rawValue === "string" || typeof rawValue === "number" ? (
        <DataTableCellCode value={rawValue} color={hex} />
      ) : (
        renderSheetFallback(rawValue)
      );
    }
    case "status-code": {
      const hex = colorMap?.[String(rawValue)];
      return typeof rawValue === "number" ? (
        <DataTableCellStatusCode value={rawValue} color={hex} />
      ) : (
        renderSheetFallback(rawValue)
      );
    }
    case "level-indicator": {
      const hex = colorMap?.[String(rawValue)];
      return typeof rawValue === "string" ? (
        <DataTableCellLevelIndicator value={rawValue} color={hex} showLabel />
      ) : (
        renderSheetFallback(rawValue)
      );
    }
    case "text": {
      const hex = colorMap?.[String(rawValue)];
      return typeof rawValue === "string" || typeof rawValue === "number" ? (
        <DataTableCellText value={rawValue} color={hex} />
      ) : (
        renderSheetFallback(rawValue)
      );
    }
    default:
      return renderSheetFallback(rawValue);
  }
}

// v9 requires `TData extends RowData` (`Record<string, any> | Array<any>`).
// A details sheet indexes its row by field name, so the object half of that
// union is the accurate constraint here.
interface DataTableSheetContentProps<TData extends Record<string, any>, TMeta>
  extends React.HTMLAttributes<HTMLDListElement> {
  data?: TData;
  table: Table<DataTableFeatures, TData>;
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

export function DataTableSheetContent<
  TData extends Record<string, any>,
  TMeta,
>({
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

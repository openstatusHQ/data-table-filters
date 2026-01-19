"use client";

import { cn } from "@/lib/utils";
import { Table } from "@tanstack/react-table";
import * as React from "react";
import { DataTableFilterField, SheetField } from "../types";
import { DataTableSheetRowAction } from "./data-table-sheet-row-action";
import { SheetDetailsContentSkeleton } from "./data-table-sheet-skeleton";

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

  let currentSection: string | undefined = undefined;

  return (
    <dl className={cn("divide-y", className)} {...props}>
      {fields.map((field) => {
        if (field.condition && !field.condition(data)) return null;

        const Component = field.component;
        const value = String(data[field.id]);

        const showSection = field.section && field.section !== currentSection;
        if (showSection) {
          currentSection = field.section;
        }

        const rowContent = (
          <>
            {field.label && (
              <dt className="shrink-0 text-muted-foreground font-medium">
                {field.label}
              </dt>
            )}
            <dd className={cn("font-mono truncate", !field.label && "col-span-2 text-left", field.label && "text-right")}>
              {Component ? (
                <Component {...data} metadata={metadata} />
              ) : (
                value
              )}
            </dd>
          </>
        );

        return (
          <React.Fragment key={field.id.toString()}>
            {showSection && (
              <div className="bg-muted/30 px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 first:rounded-t-md">
                {field.section}
              </div>
            )}
            <div className="px-4">
              {field.type === "readonly" ? (
                <div
                  className={cn(
                    "grid grid-cols-[120px_1fr] gap-4 py-3 text-sm items-center w-full",
                    field.className
                  )}
                >
                  {rowContent}
                </div>
              ) : (
                <DataTableSheetRowAction
                  fieldValue={field.id}
                  filterFields={filterFields}
                  value={value}
                  table={table}
                  className={cn(
                    "grid grid-cols-[120px_1fr] gap-4 py-3 text-sm items-center w-full",
                    field.className
                  )}
                >
                  {rowContent}
                </DataTableSheetRowAction>
              )}
            </div>
          </React.Fragment>
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

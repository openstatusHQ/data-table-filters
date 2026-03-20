"use client";

// REMINDER: React Compiler is not compatible with Tanstack Table v8 https://github.com/TanStack/table/issues/5567
"use no memo";

import { DataTableFilterCommand } from "@/components/data-table/data-table-filter-command";
import { DataTableInfinite } from "@/components/data-table/data-table-infinite";
import { useDataTable } from "@/components/data-table/data-table-provider";
import { MemoizedDataTableSheetContent } from "@/components/data-table/data-table-sheet/data-table-sheet-content";
import { DataTableSheetDetails } from "@/components/data-table/data-table-sheet/data-table-sheet-details";
import type { SheetField } from "@/components/data-table/types";
import { useMemoryAdapter } from "@/lib/store/adapters/memory";
import { DataTableStoreProvider } from "@/lib/store/provider/DataTableStoreProvider";
import { field } from "@/lib/store/schema";
import type { SchemaDefinition } from "@/lib/store/schema/types";
import {
  createTableSchema,
  generateColumns,
  generateFilterFields,
  generateFilterSchema,
  generateSheetFields,
  getDefaultColumnVisibility,
} from "@/lib/table-schema";
import { inferSchemaFromJSON } from "@/lib/table-schema/infer";
import * as React from "react";

type AutoRow = Record<string, unknown>;

export interface DataTableAutoProps {
  data: AutoRow[];
}

export function DataTableAuto({ data }: DataTableAutoProps) {
  const schemaJson = React.useMemo(() => inferSchemaFromJSON(data), [data]);

  const { definition } = React.useMemo(
    () => createTableSchema.fromJSON(schemaJson),
    [schemaJson],
  );

  const columns = React.useMemo(
    () => generateColumns<AutoRow>(definition),
    [definition],
  );

  const filterFields = React.useMemo(
    () => generateFilterFields<AutoRow>(definition),
    [definition],
  );

  const sheetFields = React.useMemo(
    () => generateSheetFields<AutoRow>(definition),
    [definition],
  );

  const defaultColumnVisibility = React.useMemo(
    () => getDefaultColumnVisibility(definition),
    [definition],
  );

  const filterSchema = React.useMemo(() => {
    const generated = generateFilterSchema(definition);
    return {
      ...generated,
      definition: {
        ...generated.definition,
        sort: field.sort(),
      },
    };
  }, [definition]);

  const adapter = useMemoryAdapter(filterSchema.definition, { id: "auto" });

  return (
    <DataTableStoreProvider adapter={adapter}>
      <DataTableAutoInner
        data={data}
        columns={columns}
        filterFields={filterFields}
        sheetFields={sheetFields}
        defaultColumnVisibility={defaultColumnVisibility}
        schema={filterSchema.definition}
      />
    </DataTableStoreProvider>
  );
}

const noop = () => Promise.resolve();
const noopRefetch = () => {};

function DataTableAutoInner({
  data,
  columns,
  filterFields,
  sheetFields,
  defaultColumnVisibility,
  schema,
}: {
  data: AutoRow[];
  columns: React.ComponentProps<
    typeof DataTableInfinite<AutoRow, unknown>
  >["columns"];
  filterFields: React.ComponentProps<
    typeof DataTableInfinite<AutoRow, unknown>
  >["filterFields"];
  sheetFields: SheetField<AutoRow>[];
  defaultColumnVisibility: Record<string, boolean>;
  schema: SchemaDefinition;
}) {
  return (
    <DataTableInfinite
      columns={columns}
      data={data}
      filterFields={filterFields}
      defaultColumnVisibility={defaultColumnVisibility}
      totalRows={data.length}
      filterRows={data.length}
      totalRowsFetched={data.length}
      hasNextPage={false}
      fetchNextPage={noop}
      refetch={noopRefetch}
      isFetching={false}
      isLoading={false}
      tableId="auto"
      commandSlot={<DataTableFilterCommand schema={schema} tableId="auto" />}
      sheetSlot={
        <AutoSheetSlot sheetFields={sheetFields} totalRows={data.length} />
      }
    />
  );
}

function AutoSheetSlot({
  sheetFields: fields,
  totalRows,
}: {
  sheetFields: SheetField<AutoRow>[];
  totalRows: number;
}) {
  const { table, rowSelection, isLoading, filterFields } = useDataTable<
    AutoRow,
    unknown
  >();
  const selectedRowKey = Object.keys(rowSelection)?.[0];
  const selectedRow = React.useMemo(() => {
    if (isLoading && !selectedRowKey) return undefined;
    return table
      .getCoreRowModel()
      .flatRows.find((row) => row.id === selectedRowKey);
  }, [selectedRowKey, isLoading, table]);

  return (
    <DataTableSheetDetails
      title={
        selectedRow ? String(Object.values(selectedRow.original)[0] ?? "") : ""
      }
      titleClassName="font-mono"
    >
      <MemoizedDataTableSheetContent
        table={table}
        data={selectedRow?.original}
        filterFields={filterFields}
        fields={fields}
        metadata={{
          totalRows,
          filterRows: totalRows,
          totalRowsFetched: totalRows,
        }}
      />
    </DataTableSheetDetails>
  );
}

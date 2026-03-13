"use client";

// REMINDER: React Compiler is not compatible with Tanstack Table v8 https://github.com/TanStack/table/issues/5567
"use no memo";

import { DataTableFilterCommand } from "@/components/data-table/data-table-filter-command";
import { DataTableInfinite } from "@/components/data-table/data-table-infinite";
import { useDataTable } from "@/components/data-table/data-table-provider";
import { MemoizedDataTableSheetContent } from "@/components/data-table/data-table-sheet/data-table-sheet-content";
import { DataTableSheetDetails } from "@/components/data-table/data-table-sheet/data-table-sheet-details";
import type {
  DataTableFilterField,
  SheetField,
} from "@/components/data-table/types";
import {
  getFacetedMinMaxValues,
  getFacetedUniqueValues,
} from "@/lib/data-table/faceted";
import type { FacetMetadataSchema } from "@/lib/data-table/types";
import { useNuqsAdapter } from "@/lib/store/adapters/nuqs";
import { useFilterState } from "@/lib/store/hooks/useFilterState";
import { DataTableStoreProvider } from "@/lib/store/provider/DataTableStoreProvider";
import { field } from "@/lib/store/schema";
import type { SchemaDefinition } from "@/lib/store/schema/types";
import {
  createTableSchema,
  generateColumns,
  generateFilterFields,
  generateFilterSchema,
  generateSheetFields,
} from "@/lib/table-schema";
import type { SchemaJSON } from "@/lib/table-schema";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import * as React from "react";
import { builderDataOptions } from "./query-options";

type BuilderRow = Record<string, unknown>;

interface BuilderTableProps {
  dataId: string;
  schemaJson: SchemaJSON;
  schemaVersion: number;
}

function BuilderTableInner({
  dataId,
  schemaJson,
}: Omit<BuilderTableProps, "schemaVersion">) {
  const { definition } = React.useMemo(
    () => createTableSchema.fromJSON(schemaJson),
    [schemaJson],
  );

  const columns = React.useMemo(
    () => generateColumns<Record<string, unknown>>(definition),
    [definition],
  );

  const filterFields = React.useMemo(
    () => generateFilterFields<Record<string, unknown>>(definition),
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

  const sheetFields = React.useMemo(
    () => generateSheetFields<BuilderRow>(definition),
    [definition],
  );

  const nuqsAdapter = useNuqsAdapter(filterSchema.definition, {
    id: "builder",
  });

  return (
    <DataTableStoreProvider adapter={nuqsAdapter}>
      <BuilderTableQuery
        dataId={dataId}
        columns={columns}
        filterFields={filterFields}
        sheetFields={sheetFields}
        schema={filterSchema.definition}
      />
    </DataTableStoreProvider>
  );
}

/**
 * Inner component that lives inside DataTableStoreProvider so it can use
 * useFilterState to read filter/sort state from the memory adapter.
 */
function BuilderTableQuery({
  dataId,
  columns,
  filterFields,
  sheetFields,
  schema,
}: {
  dataId: string;
  columns: ColumnDef<BuilderRow, unknown>[];
  filterFields: DataTableFilterField<BuilderRow>[];
  sheetFields: SheetField<BuilderRow>[];
  schema: SchemaDefinition;
}) {
  const search = useFilterState<Record<string, unknown>>();

  // Extract sort from filter state
  const sort = (search.sort as { id: string; desc: boolean } | null) ?? null;

  // Build filter object excluding non-filter keys
  const filters = React.useMemo(() => {
    const { sort: _sort, ...rest } = search;
    return rest;
  }, [search]);

  const { data, isFetching, isLoading, fetchNextPage, hasNextPage, refetch } =
    useInfiniteQuery(builderDataOptions(dataId, filters, sort));

  const flatData = React.useMemo(
    () =>
      data?.pages?.flatMap((page) => (page.data ?? []) as BuilderRow[]) ?? [],
    [data?.pages],
  );

  const lastPage = data?.pages?.[data.pages.length - 1];
  const totalDBRowCount = lastPage?.meta?.totalRowCount;
  const filterDBRowCount = lastPage?.meta?.filterRowCount;
  const facets = lastPage?.meta?.facets as
    | Record<string, FacetMetadataSchema>
    | undefined;
  const totalFetched = flatData.length;

  // Build dynamic filter fields from facets (same pattern as infinite client)
  const dynamicFilterFields = React.useMemo(() => {
    return filterFields.map((field) => {
      const facetsField = facets?.[field.value as string];
      if (!facetsField) return field;
      if (field.options && field.options.length > 0) return field;

      const options = facetsField.rows.map(({ value }) => ({
        label: `${value}`,
        value,
      }));

      if (field.type === "slider") {
        return {
          ...field,
          min: facetsField.min ?? field.min,
          max: facetsField.max ?? field.max,
          options,
        };
      }

      return { ...field, options };
    });
  }, [filterFields, facets]);

  return (
    <DataTableInfinite
      columns={columns}
      data={flatData}
      filterFields={dynamicFilterFields}
      totalRows={totalDBRowCount}
      filterRows={filterDBRowCount}
      totalRowsFetched={totalFetched}
      hasNextPage={hasNextPage}
      fetchNextPage={fetchNextPage}
      refetch={refetch}
      isFetching={isFetching}
      isLoading={isLoading}
      getFacetedUniqueValues={getFacetedUniqueValues(facets)}
      getFacetedMinMaxValues={getFacetedMinMaxValues(facets)}
      tableId="builder"
      getRowId={(row) => (row as Record<string, unknown>).__rowId as string}
      commandSlot={<DataTableFilterCommand schema={schema} tableId="builder" />}
      sheetSlot={
        <BuilderSheetSlot
          sheetFields={sheetFields}
          totalRows={totalDBRowCount ?? 0}
          filterRows={filterDBRowCount ?? 0}
          totalRowsFetched={totalFetched}
        />
      }
    />
  );
}

function BuilderSheetSlot({
  sheetFields: fields,
  totalRows,
  filterRows,
  totalRowsFetched,
}: {
  sheetFields: SheetField<BuilderRow>[];
  totalRows: number;
  filterRows: number;
  totalRowsFetched: number;
}) {
  const { table, rowSelection, isLoading, filterFields } = useDataTable<
    BuilderRow,
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
          filterRows,
          totalRowsFetched,
        }}
      />
    </DataTableSheetDetails>
  );
}

/**
 * Dynamic table driven entirely by a `SchemaJSON` descriptor, using the
 * same `DataTableInfinite` component as the /infinite route.
 *
 * `schemaVersion` keys the inner component to force full remount when the
 * schema changes, resetting all table state.
 */
export function BuilderTable({
  dataId,
  schemaJson,
  schemaVersion,
}: BuilderTableProps) {
  return (
    <BuilderTableInner
      key={schemaVersion}
      dataId={dataId}
      schemaJson={schemaJson}
    />
  );
}

"use client";

// REMINDER: React Compiler is not compatible with Tanstack Table v8 https://github.com/TanStack/table/issues/5567
"use no memo";

import {
  getFacetedMinMaxValues,
  getFacetedUniqueValues,
} from "@/app/infinite/client";
import { DataTableInfinite } from "@/app/infinite/data-table-infinite";
import type { FacetMetadataSchema } from "@/app/infinite/schema";
import type {
  DataTableFilterField,
  SheetField,
} from "@/components/data-table/types";
import { DataTableStoreProvider, useFilterState } from "@/lib/store";
import { useMemoryAdapter } from "@/lib/store/adapters/memory";
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

  const filterSchema = React.useMemo(
    () => generateFilterSchema(definition),
    [definition],
  );

  const sheetFields = React.useMemo(
    () => generateSheetFields<BuilderRow>(definition),
    [definition],
  );

  const memoryAdapter = useMemoryAdapter(filterSchema.definition);

  return (
    <DataTableStoreProvider adapter={memoryAdapter}>
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
      sheetFields={sheetFields}
      totalRows={totalDBRowCount}
      filterRows={filterDBRowCount}
      totalRowsFetched={totalFetched}
      hasNextPage={hasNextPage}
      fetchNextPage={fetchNextPage}
      refetch={refetch}
      isFetching={isFetching}
      isLoading={isLoading}
      meta={{}}
      chartData={[]}
      chartDataColumnId={undefined}
      getFacetedUniqueValues={getFacetedUniqueValues(facets)}
      getFacetedMinMaxValues={getFacetedMinMaxValues(facets)}
      renderSheetTitle={({ row }) =>
        row ? String(Object.values(row.original)[0] ?? "") : ""
      }
      schema={schema}
      tableId="builder"
    />
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

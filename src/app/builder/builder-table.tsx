"use client";

// REMINDER: React Compiler is not compatible with Tanstack Table v8 https://github.com/TanStack/table/issues/5567
"use no memo";

import { DataTableInfinite } from "@/app/infinite/data-table-infinite";
import type { SheetField } from "@/components/data-table/types";
import { DataTableStoreProvider } from "@/lib/store";
import type { InternalStoreAdapter } from "@/lib/store/adapter/types";
import type { SchemaDefinition } from "@/lib/store/schema/types";
import {
  createTableSchema,
  generateColumns,
  generateFilterFields,
  generateFilterSchema,
} from "@/lib/table-schema";
import type { SchemaJSON, TableSchemaDefinition } from "@/lib/table-schema";
import * as React from "react";

type BuilderRow = Record<string, unknown>;

function generateBuilderSheetFields(
  definition: TableSchemaDefinition,
): SheetField<BuilderRow>[] {
  return Object.entries(definition).map(([key, builder]) => ({
    id: key as keyof BuilderRow,
    label: builder._config.label,
    type: "readonly" as const,
    component: (props: BuilderRow) => {
      const val = props[key];
      if (val === null || val === undefined) return String(val);
      if (typeof val === "object") return JSON.stringify(val);
      return String(val);
    },
  }));
}

interface BuilderTableProps {
  data: Record<string, unknown>[];
  schemaJson: SchemaJSON;
  schemaVersion: number;
}

/**
 * Minimal no-op adapter for the builder. The builder manages all filtering
 * state inside React Table itself — no URL sync or persistence needed.
 */
function useNoopAdapter(
  schema: SchemaDefinition,
): InternalStoreAdapter<Record<string, unknown>> {
  return React.useMemo(
    () => ({
      subscribe: () => () => {},
      getSnapshot: () => ({ state: {}, version: 0 }),
      getServerSnapshot: () => ({ state: {}, version: 0 }),
      setState: () => {},
      setField: () => {},
      reset: () => {},
      pause: () => {},
      resume: () => {},
      isPaused: () => false,
      destroy: () => {},
      getTableId: () => "builder",
      getSchema: () => schema,
      getDefaults: () => ({}),
    }),
    [schema],
  );
}

function BuilderTableInner({
  data,
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
    () => generateBuilderSheetFields(definition),
    [definition],
  );

  const noopAdapter = useNoopAdapter(filterSchema.definition);

  return (
    <DataTableStoreProvider adapter={noopAdapter}>
      <DataTableInfinite
        columns={columns}
        data={data}
        filterFields={filterFields}
        sheetFields={sheetFields}
        totalRows={data.length}
        filterRows={data.length}
        totalRowsFetched={data.length}
        hasNextPage={false}
        fetchNextPage={() => Promise.resolve()}
        refetch={() => {}}
        meta={{}}
        chartData={[]}
        chartDataColumnId={undefined}
        renderSheetTitle={({ row }) =>
          row ? String(Object.values(row.original)[0] ?? "") : ""
        }
        schema={filterSchema.definition}
        tableId="builder"
      />
    </DataTableStoreProvider>
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
  data,
  schemaJson,
  schemaVersion,
}: BuilderTableProps) {
  return (
    <BuilderTableInner
      key={schemaVersion}
      data={data}
      schemaJson={schemaJson}
    />
  );
}

"use client";

import type { DataTableFilterField } from "@dtf/registry/components/data-table/types";
import type { AdapterType } from "@dtf/registry/lib/store/adapter/types";
import { useNuqsAdapter } from "@dtf/registry/lib/store/adapters/nuqs";
import { useZustandAdapter } from "@dtf/registry/lib/store/adapters/zustand";
import { DataTableStoreProvider } from "@dtf/registry/lib/store/provider/DataTableStoreProvider";
import type { DataTableFeatures } from "@dtf/registry/lib/table/features";
import type { ColumnDef, RowData } from "@tanstack/react-table";
import * as React from "react";
import { DataTable } from "./data-table";
import { filterSchema } from "./schema";
import type { SearchParamsType } from "./search-params";
import { useFilterStore } from "./store";

export interface ClientProps<TData extends RowData> {
  columns: ColumnDef<DataTableFeatures, TData>[];
  data: TData[];
  filterFields?: DataTableFilterField<TData>[];
  defaultAdapterType?: AdapterType;
  initialState?: SearchParamsType;
}

export function Client<TData extends RowData>({
  columns,
  data,
  filterFields = [],
  defaultAdapterType = "nuqs",
  initialState,
}: ClientProps<TData>) {
  return (
    <React.Fragment>
      {defaultAdapterType === "nuqs" ? (
        <NuqsClient
          columns={columns}
          data={data}
          filterFields={filterFields}
          initialState={initialState}
        />
      ) : (
        <ZustandClient
          columns={columns}
          data={data}
          filterFields={filterFields}
          initialState={initialState}
        />
      )}
    </React.Fragment>
  );
}

interface InnerClientProps<TData extends RowData> {
  columns: ColumnDef<DataTableFeatures, TData>[];
  data: TData[];
  filterFields: DataTableFilterField<TData>[];
  initialState?: SearchParamsType;
}

function NuqsClient<TData extends RowData>({
  columns,
  data,
  filterFields,
  initialState,
}: InnerClientProps<TData>) {
  const adapter = useNuqsAdapter(filterSchema.definition, {
    id: "default",
    initialState,
  });

  return (
    <DataTableStoreProvider adapter={adapter}>
      <DataTable columns={columns} data={data} filterFields={filterFields} />
    </DataTableStoreProvider>
  );
}

function ZustandClient<TData extends RowData>({
  columns,
  data,
  filterFields,
  initialState,
}: InnerClientProps<TData>) {
  const adapter = useZustandAdapter(useFilterStore, filterSchema.definition, {
    id: "default",
    initialState,
  });

  return (
    <DataTableStoreProvider adapter={adapter}>
      <DataTable columns={columns} data={data} filterFields={filterFields} />
    </DataTableStoreProvider>
  );
}

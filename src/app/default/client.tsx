"use client";

import type { DataTableFilterField } from "@/components/data-table/types";
import { DataTableStoreProvider, type AdapterType } from "@/lib/store";
import { useNuqsAdapter } from "@/lib/store/adapters/nuqs";
import { useZustandAdapter } from "@/lib/store/adapters/zustand";
import type { ColumnDef } from "@tanstack/react-table";
import * as React from "react";
import { DataTable } from "./data-table";
import { filterSchema } from "./schema";
import { useFilterStore } from "./store";

export interface ClientProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  filterFields?: DataTableFilterField<TData>[];
  defaultAdapterType?: AdapterType;
}

export function Client<TData, TValue>({
  columns,
  data,
  filterFields = [],
  defaultAdapterType = "nuqs",
}: ClientProps<TData, TValue>) {
  return (
    <React.Fragment>
      {defaultAdapterType === "nuqs" ? (
        <NuqsClient columns={columns} data={data} filterFields={filterFields} />
      ) : (
        <ZustandClient
          columns={columns}
          data={data}
          filterFields={filterFields}
        />
      )}
    </React.Fragment>
  );
}

interface InnerClientProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  filterFields: DataTableFilterField<TData>[];
}

function NuqsClient<TData, TValue>({
  columns,
  data,
  filterFields,
}: InnerClientProps<TData, TValue>) {
  const adapter = useNuqsAdapter(filterSchema.definition, { id: "default" });

  return (
    <DataTableStoreProvider adapter={adapter}>
      <DataTable columns={columns} data={data} filterFields={filterFields} />
    </DataTableStoreProvider>
  );
}

function ZustandClient<TData, TValue>({
  columns,
  data,
  filterFields,
}: InnerClientProps<TData, TValue>) {
  const adapter = useZustandAdapter(useFilterStore, filterSchema.definition, {
    id: "default",
  });

  return (
    <DataTableStoreProvider adapter={adapter}>
      <DataTable columns={columns} data={data} filterFields={filterFields} />
    </DataTableStoreProvider>
  );
}

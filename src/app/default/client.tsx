"use client";

import { useQuery } from "@tanstack/react-query";
import { columns } from "./columns";
import { filterFields } from "./constants";
import { DataTable } from "./data-table";
import { dataOptions } from "./query-options";
import { useQueryStates } from "nuqs";
import { searchParamsParser } from "./search-params";

export function Client() {
  const [search] = useQueryStates(searchParamsParser);
  const { data } = useQuery(dataOptions(search));

  if (!data) return null;

  return (
    <DataTable
      columns={columns}
      data={data.data}
      filterFields={filterFields}
      defaultColumnFilters={Object.entries(search)
        .map(([key, value]) => ({
          id: key,
          value,
        }))
        .filter(({ value }) => value ?? undefined)}
    />
  );
}

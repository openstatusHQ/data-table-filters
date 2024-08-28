"use client";

import { columns } from "@/_data-table/columns";
import { data, filterFields } from "@/_data-table/constants";
import { DataTable } from "@/_data-table/data-table";
import { columnFilterSchema } from "@/_data-table/schema";
import { Badge } from "@/components/ui/badge";

export default function Page({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const search = columnFilterSchema.safeParse(searchParams);

  if (!search.success) {
    console.log(search.error);
    return null;
  }

  return (
    <main className="container mx-auto flex min-h-screen flex-col gap-4 px-2 py-4 md:px-4 md:py-8">
      <div className="relative flex flex-1 flex-col rounded-lg border border-border/50 bg-background/50 p-4 backdrop-blur-[2px] sm:p-8">
        <DataTable
          columns={columns}
          data={data}
          filterFields={filterFields}
          defaultColumnFilters={Object.entries(search.data).map(
            ([key, value]) => ({
              id: key,
              value,
            })
          )}
        />
        <Badge
          variant="outline"
          className="absolute -top-2.5 left-4 bg-background sm:left-8"
        >
          Work in progress
        </Badge>
      </div>
    </main>
  );
}

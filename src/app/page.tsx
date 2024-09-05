import { columns } from "@/_data-table/columns";
import { data, filterFields } from "@/_data-table/constants";
import { DataTable } from "@/_data-table/data-table";
import { searchParamsCache } from "@/_data-table/search-params";
import { Badge } from "@/components/ui/badge";

export default function Page({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const search = searchParamsCache.parse(searchParams);

  return (
    <main className="container mx-auto flex min-h-screen flex-col gap-4 px-2 py-4 md:px-4 md:py-8">
      <div className="relative min-h-full h-full rounded-lg border border-border/50 bg-background/50 p-4 backdrop-blur-[2px] sm:p-8">
        <DataTable
          columns={columns}
          data={data}
          filterFields={filterFields}
          defaultColumnFilters={Object.entries(search)
            .map(([key, value]) => ({
              id: key,
              value,
            }))
            .filter(({ value }) => value ?? undefined)}
        />
        <Badge
          variant="outline"
          className="absolute -top-2.5 left-4 bg-background sm:left-8"
        >
          Work in progress
        </Badge>
      </div>
      <p className="text-muted-foreground text-center">
        An{" "}
        <a
          href="https://github.com/openstatusHQ/data-table-filters"
          target="_blank"
          className="text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground"
        >
          open-source
        </a>{" "}
        data-table created by{" "}
        <a
          href="https://openstatus.dev"
          target="_blank"
          className="text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground"
        >
          OpenStatus
        </a>
        .
      </p>
    </main>
  );
}

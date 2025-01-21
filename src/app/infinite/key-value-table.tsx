import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/custom/table";

interface KeyValueTableProps {
  data: Record<string, string>;
}
// TODO: add copy to clipboard?
export function KeyValueTable({ data }: KeyValueTableProps) {
  return (
    <div className="mx-auto max-w-lg">
      <div className="overflow-hidden rounded-lg border border-border bg-background">
        <Table>
          <TableBody>
            {Object.entries(data).map(([key, value]) => {
              return (
                <TableRow
                  key={key}
                  className="*:border-border hover:bg-transparent [&>:not(:last-child)]:border-r"
                >
                  <TableCell className="bg-muted/50 py-1 font-medium">
                    {key}
                  </TableCell>
                  <TableCell className="py-1">{value}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

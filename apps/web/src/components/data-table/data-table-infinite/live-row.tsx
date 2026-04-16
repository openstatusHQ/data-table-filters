import { TableCell, TableRow } from "@dtf/registry/components/custom/table";
import { DataTableColumnLevelIndicator } from "@/components/data-table/data-table-column/data-table-column-level-indicator";

export function LiveRow({ colSpan }: { colSpan: number }) {
  return (
    <TableRow>
      <TableCell className="border-info border-r-info/50 w-(--header-level-size) max-w-(--header-level-size) min-w-(--header-level-size) border-t border-r border-b border-l">
        <DataTableColumnLevelIndicator value="info" />
      </TableCell>
      <TableCell
        colSpan={colSpan}
        className="border-info text-info border-t border-r border-b font-medium"
      >
        Live Mode
      </TableCell>
    </TableRow>
  );
}

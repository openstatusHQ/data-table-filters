import { TableCell, TableRow } from "@/components/custom/table";
import { DataTableColumnLevelIndicator } from "@/components/data-table/data-table-column/data-table-column-level-indicator";

export function LiveRow({ colSpan }: { colSpan: number }) {
  return (
    <TableRow>
      <TableCell className="w-[--header-level-size] min-w-[--header-level-size] max-w-[--header-level-size] border-b border-l border-r border-t border-info border-r-info/50">
        <DataTableColumnLevelIndicator value="info" />
      </TableCell>
      <TableCell
        colSpan={colSpan}
        className="border-b border-r border-t border-info font-medium text-info"
      >
        Live Mode
      </TableCell>
    </TableRow>
  );
}

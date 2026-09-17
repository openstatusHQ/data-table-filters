import { DataTableColumnLevelIndicator } from "@/components/data-table/data-table-column/data-table-column-level-indicator";
import { cn } from "@/lib/utils";
import { TableCell, TableRow } from "@dtf/registry/components/custom/table";
import { useDataTable } from "@dtf/registry/components/data-table/data-table-provider";
import * as React from "react";
import { getLiveRowLayout } from "./live-row-layout";

interface LiveRowProps {
  /**
   * The column the indicator sits under. Defaults to the `level` column so it
   * lines up with the row level indicators.
   */
  indicatorColumnId?: string;
  /** Rendered in the indicator cell. Defaults to the "info" level indicator. */
  indicator?: React.ReactNode;
  /** Rendered in the label cell. Defaults to "Live Mode". */
  children?: React.ReactNode;
  className?: string;
}

/** The width the table gives a column, from the size vars it sets on its container. */
function columnWidth(id: string): React.CSSProperties {
  const width = `var(--col-${id.replaceAll(".", "-")}-size)`;
  return { width, minWidth: width, maxWidth: width };
}

/**
 * A marker row that separates rows fetched before live mode was switched on
 * from the ones streaming in after it.
 *
 * It lays itself out from the table's visible columns: one empty cell per
 * column before the indicator column, the indicator, then a label spanning the
 * rest. Rendered from `renderLiveRow`, so it must sit inside the data table
 * provider.
 */
export function LiveRow({
  indicatorColumnId = "level",
  indicator = <DataTableColumnLevelIndicator value="info" />,
  children = "Live Mode",
  className,
}: LiveRowProps) {
  const { table } = useDataTable();
  const {
    leading,
    indicator: indicatorId,
    span,
  } = getLiveRowLayout(
    table.getVisibleLeafColumns().map((column) => column.id),
    indicatorColumnId,
  );

  // Same vertical separators as the data rows (see the row rule in the
  // infinite table), tinted like the indicator's right edge.
  const cellClassName = "border-info border-r-info/50 border-t border-b";

  return (
    <TableRow className={cn("[&>:not(:last-child)]:border-r", className)}>
      {leading.map((id, index) => (
        <TableCell
          key={id}
          style={columnWidth(id)}
          className={cn(cellClassName, index === 0 && "border-l")}
        />
      ))}
      {indicatorId ? (
        <TableCell
          style={columnWidth(indicatorId)}
          className={cn(cellClassName, leading.length === 0 && "border-l")}
        >
          {indicator}
        </TableCell>
      ) : null}
      {span > 0 ? (
        <TableCell
          colSpan={span}
          className={cn(
            cellClassName,
            "border-r-info text-info border-r font-medium",
            leading.length === 0 && !indicatorId && "border-l",
          )}
        >
          {children}
        </TableCell>
      ) : null}
    </TableRow>
  );
}

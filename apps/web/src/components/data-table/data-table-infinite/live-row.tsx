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

type LiveRowCell = {
  key: string;
  style?: React.CSSProperties;
  colSpan?: number;
  content?: React.ReactNode;
  /** Styled as the label (tinted, medium weight). */
  label?: boolean;
};

/**
 * A marker row that separates rows fetched before live mode was switched on
 * from the ones streaming in after it.
 *
 * It lays itself out from the table's visible columns: one empty cell per
 * column before the indicator column, the indicator, then a label spanning the
 * rest. When nothing follows the indicator the label moves in front of it (or
 * into its cell when it is the only column) rather than disappearing — see
 * `getLiveRowLayout`. Rendered from `renderLiveRow`, so it must sit inside the
 * data table provider.
 */
export function LiveRow({
  indicatorColumnId = "level",
  indicator = <DataTableColumnLevelIndicator value="info" />,
  children = "Live Mode",
  className,
}: LiveRowProps) {
  const { table } = useDataTable();
  const layout = getLiveRowLayout(
    table.getVisibleLeafColumns().map((column) => column.id),
    indicatorColumnId,
  );

  const cells: LiveRowCell[] = [];
  const labelCell = (colSpan: number): LiveRowCell => ({
    key: "label",
    colSpan,
    content: children,
    label: true,
  });
  const indicatorCell = (id: string): LiveRowCell => ({
    key: id,
    style: columnWidth(id),
    content: indicator,
  });

  if (layout.label === "before" && layout.indicator) {
    cells.push(labelCell(layout.span), indicatorCell(layout.indicator));
  } else if (layout.label === "indicator" && layout.indicator) {
    // The only column: let it grow to fit the label instead of clipping it.
    cells.push({
      key: layout.indicator,
      content: (
        <span className="flex items-center gap-2">
          {indicator}
          {children}
        </span>
      ),
      label: true,
    });
  } else {
    for (const id of layout.leading) {
      cells.push({ key: id, style: columnWidth(id) });
    }
    if (layout.indicator) cells.push(indicatorCell(layout.indicator));
    if (layout.span > 0) cells.push(labelCell(layout.span));
  }

  return (
    <TableRow className={cn("[&>:not(:last-child)]:border-r", className)}>
      {cells.map((cell, index) => (
        <TableCell
          key={cell.key}
          style={cell.style}
          colSpan={cell.colSpan}
          className={cn(
            // Same vertical separators as the data rows (see the row rule in
            // the infinite table), tinted like the row's right edge.
            "border-info border-r-info/50 border-t border-b",
            index === 0 && "border-l",
            index === cells.length - 1 && "border-r-info border-r",
            cell.label && "text-info font-medium",
          )}
        >
          {cell.content}
        </TableCell>
      ))}
    </TableRow>
  );
}

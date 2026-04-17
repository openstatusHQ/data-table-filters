import { getStatusColor } from "@dtf/registry/lib/request/status-code";

export function DataTableCellStatusCode({
  value,
  color,
}: {
  value: number;
  color?: string;
}) {
  const colors = getStatusColor(value);
  return (
    <span
      className={`font-mono ${color ? "" : colors.text}`}
      style={color ? { color } : undefined}
    >
      {value}
    </span>
  );
}

import { getStatusColor } from "@/lib/request/status-code";

export function DataTableCellStatusCode({ value }: { value: number }) {
  const colors = getStatusColor(value);
  return <span className={`font-mono ${colors.text}`}>{value}</span>;
}

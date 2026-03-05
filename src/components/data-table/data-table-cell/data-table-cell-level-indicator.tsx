const LEVEL_COLORS: Record<string, string> = {
  error: "bg-red-500",
  warn: "bg-yellow-500",
  warning: "bg-yellow-500",
  info: "bg-blue-500",
  debug: "bg-gray-400",
  success: "bg-green-500",
};

export function DataTableCellLevelIndicator({ value }: { value: string }) {
  const color = LEVEL_COLORS[value.toLowerCase()] ?? "bg-gray-300";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${color}`} />
      <span>{value}</span>
    </span>
  );
}

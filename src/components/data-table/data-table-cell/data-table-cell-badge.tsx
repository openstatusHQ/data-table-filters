export function DataTableCellBadge({ value }: { value: string | number }) {
  return (
    <span className="rounded-sm border px-1.5 py-0.5 font-mono text-xs">
      {value}
    </span>
  );
}

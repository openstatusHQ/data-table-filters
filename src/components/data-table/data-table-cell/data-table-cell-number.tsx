export function DataTableCellNumber({
  value,
  unit,
}: {
  value: number;
  unit?: string;
}) {
  const formatted = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 3,
  }).format(value);

  return (
    <span className="font-mono">
      {formatted}
      {unit && <span className="text-muted-foreground">{unit}</span>}
    </span>
  );
}

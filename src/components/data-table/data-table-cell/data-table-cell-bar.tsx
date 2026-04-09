export function DataTableCellBar({
  value,
  min,
  max,
  unit,
  color,
}: {
  value: number;
  min: number;
  max: number;
  unit?: string;
  color?: string;
}) {
  const range = max - min;
  const pct =
    range > 0 ? Math.max(0, Math.min(100, ((value - min) / range) * 100)) : 0;

  const formatted = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 3,
  }).format(value);

  return (
    <span className="relative -m-2 inline-flex w-full items-center p-2 font-mono">
      <span
        className="absolute inset-y-0 left-0 opacity-15"
        style={{
          width: `${pct}%`,
          backgroundColor: color ?? "currentColor",
        }}
      />
      <span className="relative">
        {formatted}
        {unit && <span className="text-muted-foreground">{unit}</span>}
      </span>
    </span>
  );
}

export function DataTableCellHeatmap({
  value,
  min,
  max,
  color,
}: {
  value: number;
  min: number;
  max: number;
  color?: string;
}) {
  const range = max - min;
  const pct = range > 0 ? Math.max(0, Math.min(1, (value - min) / range)) : 0;
  // Opacity scales from 0.05 (min) to 0.5 (max) for readable text
  const opacity = 0.05 + pct * 0.45;
  const baseColor = color ?? "#ef4444";

  const formatted = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 3,
  }).format(value);

  return (
    <span
      className="-m-2 inline-flex items-center rounded-sm p-2 font-mono"
      style={{
        backgroundColor: `color-mix(in srgb, ${baseColor} ${Math.round(opacity * 100)}%, transparent)`,
      }}
    >
      {formatted}
    </span>
  );
}

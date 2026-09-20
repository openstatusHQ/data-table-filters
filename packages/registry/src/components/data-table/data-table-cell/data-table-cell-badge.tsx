import { boxRadiusClassName } from "@dtf/registry/lib/style";
import { cn } from "@dtf/registry/lib/utils";

export function DataTableCellBadge({
  value,
  color,
}: {
  value: string | number;
  color?: string;
}) {
  return (
    <span
      className={cn(
        "border px-1.5 py-0.5 font-mono text-xs",
        boxRadiusClassName,
      )}
      style={
        color
          ? {
              color,
              backgroundColor: `${color}1a`,
              borderColor: `${color}33`,
            }
          : undefined
      }
    >
      {value}
    </span>
  );
}

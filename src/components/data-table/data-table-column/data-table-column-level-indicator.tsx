import { _LEVELS } from "@/constants/levels";
import { getLevelColor } from "@/lib/request/level";
import { cn } from "@/lib/utils";

export function DataTableColumnLevelIndicator({
  value,
  className,
}: {
  value: (typeof _LEVELS)[number];
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-center", className)}>
      <div className={cn("size-3.5 rounded-sm", getLevelColor(value).bg)} />
    </div>
  );
}

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
      <div
        className={cn("h-2.5 w-2.5 rounded-[2px]", getLevelColor(value).bg)}
      />
    </div>
  );
}

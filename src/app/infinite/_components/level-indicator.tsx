import { _LEVELS } from "@/constants/levels";
import { getLevelColor } from "@/lib/request/level";
import { cn } from "@/lib/utils";

export function LevelIndicator({ level }: { level: (typeof _LEVELS)[number] }) {
  return (
    <div className="flex items-center justify-center">
      <div
        className={cn("h-2.5 w-2.5 rounded-[2px]", getLevelColor(level).bg)}
      />
    </div>
  );
}

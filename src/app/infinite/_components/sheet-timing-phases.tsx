import { formatMilliseconds } from "@/lib/format";
import {
  getTimingColor,
  getTimingLabel,
  getTimingPercentage,
  TimingPhase,
  timingPhases,
} from "@/lib/request/timing";
import { cn } from "@/lib/utils";

export function SheetTimingPhases({
  latency,
  timing,
  className,
}: {
  latency: number;
  timing: Record<TimingPhase, number>;
  className?: string;
}) {
  const timingPercentage = getTimingPercentage(timing, latency);
  return (
    <div className={cn("w-full space-y-1 text-left", className)}>
      {timingPhases.map((phase) => (
        <div
          key={phase}
          className="grid grid-cols-3 items-center justify-between gap-2 text-xs"
        >
          <div className="truncate font-mono uppercase text-foreground">
            {getTimingLabel(phase)}
          </div>
          <div className="flex flex-1 gap-2 items-center justify-end">
            <div className="font-mono text-[10px] text-muted-foreground tabular-nums">
              {timingPercentage[phase]}
            </div>
            <div className="font-mono tabular-nums">
              {formatMilliseconds(timing[phase])}
              <span className="text-muted-foreground ml-0.5">ms</span>
            </div>
            <div className="w-16 flex justify-end">
              <div
                className={cn(getTimingColor(phase), "h-1.5 rounded-full")}
                style={{ width: `${(timing[phase] / latency) * 100}%` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

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
          <div className="col-span-2 flex gap-2">
            <div className="mr-8 font-mono text-muted-foreground">
              {timingPercentage[phase]}
            </div>
            <div className="flex flex-1 items-center justify-end gap-2">
              <div className="font-mono">
                {formatMilliseconds(timing[phase])}
                <span className="text-muted-foreground">ms</span>
              </div>
            </div>
            <div
              className={cn(getTimingColor(phase), "h-4")}
              style={{ width: `${(timing[phase] / latency) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

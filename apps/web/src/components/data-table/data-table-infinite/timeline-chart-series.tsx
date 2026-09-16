import { LEVELS } from "@/constants/levels";
import { getLevelLabel } from "@/lib/request/level";
import type { TimelineChartSeries } from "@dtf/registry/components/data-table/data-table-chart/timeline-chart";

/**
 * The series every demo stacks, bottom-up, with the status-class label
 * (`2xx`, `4xx`, `5xx`) next to the level in the tooltip.
 */
export const timelineChartSeries: TimelineChartSeries[] = (
  ["error", "warning", "success"] satisfies readonly (typeof LEVELS)[number][]
).map((level) => ({ key: level, label: <TooltipLabel level={level} /> }));

function TooltipLabel({ level }: { level: (typeof LEVELS)[number] }) {
  return (
    <div className="mr-2 flex w-20 items-center justify-between gap-2 font-mono">
      <div className="text-foreground/70 capitalize">{level}</div>
      <div className="text-muted-foreground/70 text-xs">
        {getLevelLabel(level)}
      </div>
    </div>
  );
}

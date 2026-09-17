"use client";

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@dtf/registry/components/ui/hover-card";
import { formatMilliseconds } from "@dtf/registry/lib/format";
import type { DataTableFeatures } from "@dtf/registry/lib/table/features";
import { cn } from "@dtf/registry/lib/utils";
import type { ColumnDef } from "@tanstack/react-table";
import type { ColumnSchema } from "./table-schema";
import {
  getTimingColor,
  getTimingLabel,
  getTimingPercentage,
  pickTiming,
  TIMING_PHASES,
  type Timing,
} from "./timing";

/** One stacked bar, each phase as wide as its share of the latency. */
function TimingBar({
  timing,
  latency,
  className,
}: {
  timing: Timing;
  latency: number;
  className?: string;
}) {
  return (
    <div className={cn("flex", className)}>
      {TIMING_PHASES.map((phase) => (
        <div
          key={phase}
          className={cn(getTimingColor(phase), "h-4")}
          style={{ width: `${(timing[phase] / latency) * 100}%` }}
        />
      ))}
    </div>
  );
}

/**
 * A column that spans five schema columns, so it cannot be generated from
 * one of them: append it to `generateColumns(...)` by hand. The bar reads the
 * phases through `row.getValue`, which resolves the dotted keys.
 */
export const timingPhasesColumn: ColumnDef<DataTableFeatures, ColumnSchema> = {
  id: "timing",
  header: () => <div className="whitespace-nowrap">Timing Phases</div>,
  cell: ({ row }) => {
    const timing = pickTiming(row.original);
    const latency = row.original.latency;
    const percentage = getTimingPercentage(timing, latency);
    return (
      <HoverCard openDelay={50} closeDelay={50}>
        <HoverCardTrigger
          className="opacity-70 hover:opacity-100 data-[state=open]:opacity-100"
          asChild
        >
          <div>
            <TimingBar timing={timing} latency={latency} />
          </div>
        </HoverCardTrigger>
        <HoverCardContent side="bottom" align="end" className="z-10 w-auto p-2">
          <div className="flex flex-col gap-1">
            {TIMING_PHASES.map((phase) => (
              <div key={phase} className="grid grid-cols-2 gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      getTimingColor(phase),
                      "h-2 w-2 rounded-full",
                    )}
                  />
                  <div className="text-accent-foreground font-mono uppercase">
                    {getTimingLabel(phase)}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div className="text-muted-foreground font-mono">
                    {percentage[phase]}
                  </div>
                  <div className="font-mono">
                    {formatMilliseconds(timing[phase])}
                    <span className="text-muted-foreground">ms</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </HoverCardContent>
      </HoverCard>
    );
  },
  enableResizing: false,
  size: 130,
  minSize: 130,
  // Pins the width: the bars have no intrinsic size, so without a fixed width
  // the column would collapse once another column claims the leftover width.
  maxSize: 130,
  meta: { label: "Timing Phases" },
};

/**
 * The row sheet's "Timing Phases" section. The sheet renders a field's
 * `component` with the whole row as props, hence the loose parameter type:
 * `SheetConfig.component` is typed `(row: unknown) => …`.
 */
export function SheetTimingPhases(props: unknown) {
  const row = props as ColumnSchema;
  const timing = pickTiming(row);
  const percentage = getTimingPercentage(timing, row.latency);
  return (
    <div className="w-full space-y-1 text-left">
      {TIMING_PHASES.map((phase) => (
        <div
          key={phase}
          className="grid grid-cols-3 items-center justify-between gap-2 text-xs"
        >
          <div className="text-foreground truncate font-mono uppercase">
            {getTimingLabel(phase)}
          </div>
          <div className="col-span-2 flex gap-2">
            <div className="text-muted-foreground mr-8 font-mono">
              {percentage[phase]}
            </div>
            <div className="flex flex-1 items-center justify-end gap-2">
              <div className="font-mono">
                {formatMilliseconds(timing[phase])}
                <span className="text-muted-foreground">ms</span>
              </div>
            </div>
            <div
              className={cn(getTimingColor(phase), "h-4")}
              style={{ width: `${(timing[phase] / row.latency) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

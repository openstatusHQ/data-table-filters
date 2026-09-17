"use client";

import { HOVER_CARD_DELAY } from "@dtf/registry/components/data-table/ui-compat";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@dtf/registry/components/ui/hover-card";
import { formatMilliseconds } from "@dtf/registry/lib/format";
import type { DataTableFeatures } from "@dtf/registry/lib/table/features";
import { cn } from "@dtf/registry/lib/utils";
import type { ColumnDef } from "@tanstack/react-table";
import {
  getTimingColor,
  getTimingLabel,
  getTimingPercentage,
  getTimingShare,
  pickTiming,
  TIMING_PHASES,
  type Timing,
  type TimingRow,
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
          style={{ width: `${getTimingShare(timing, phase, latency)}%` }}
        />
      ))}
    </div>
  );
}

/**
 * A column that spans five schema columns, so it cannot be generated from
 * one of them: append `timingPhasesColumn<ColumnSchema>()` to
 * `generateColumns(...)` by hand. The bar reads the phases off `row.original`,
 * whose flat dotted keys are the schema's.
 *
 * A factory rather than one def so the column takes the table's own row type:
 * any row carrying `latency` and the phases fits, which is how the docs site's
 * demos share it.
 */
export function timingPhasesColumn<TData extends TimingRow>(): ColumnDef<
  DataTableFeatures,
  TData
> {
  return {
    id: "timing",
    header: () => <div className="whitespace-nowrap">Timing Phases</div>,
    cell: ({ row }) => {
      const timing = pickTiming(row.original);
      const latency = row.original.latency;
      const percentage = getTimingPercentage(timing, latency);
      return (
        // The props are spread, and the trigger has no `asChild`, on purpose:
        // this file ships as `registry:file`, which the shadcn CLI copies
        // verbatim — its Base UI codemod (`asChild` → `render`) never runs on
        // it, and a literal `openDelay` fails to typecheck on Base UI's
        // preview card. So the trigger renders its own element, with the
        // open-state class in both libraries' spelling.
        <HoverCard {...HOVER_CARD_DELAY}>
          <HoverCardTrigger className="block opacity-70 hover:opacity-100 data-open:opacity-100 data-[state=open]:opacity-100">
            <TimingBar timing={timing} latency={latency} />
          </HoverCardTrigger>
          <HoverCardContent
            side="bottom"
            align="end"
            className="z-10 w-auto p-2"
          >
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
}

/**
 * The row sheet's "Timing Phases" section. The sheet renders a field's
 * `component` with the whole row as props, hence the loose parameter type:
 * `SheetConfig.component` is typed `(row: unknown) => …`.
 */
export function SheetTimingPhases(props: unknown) {
  const row = props as TimingRow;
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
              style={{
                width: `${getTimingShare(timing, phase, row.latency)}%`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

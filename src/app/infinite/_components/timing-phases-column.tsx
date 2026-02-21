"use client";

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  getTimingColor,
  getTimingLabel,
  getTimingPercentage,
  timingPhases,
} from "@/lib/request/timing";
import { cn } from "@/lib/utils";
import { HoverCardPortal } from "@radix-ui/react-hover-card";
import type { ColumnDef } from "@tanstack/react-table";
import type { ColumnSchema } from "../schema";

export const timingPhasesColumn: ColumnDef<ColumnSchema> = {
  accessorKey: "timing",
  header: () => <div className="whitespace-nowrap">Timing Phases</div>,
  cell: ({ row }) => {
    const timing = {
      "timing.dns": row.getValue<ColumnSchema["timing.dns"]>("timing.dns"),
      "timing.connection":
        row.getValue<ColumnSchema["timing.connection"]>("timing.connection"),
      "timing.tls": row.getValue<ColumnSchema["timing.tls"]>("timing.tls"),
      "timing.ttfb": row.getValue<ColumnSchema["timing.ttfb"]>("timing.ttfb"),
      "timing.transfer":
        row.getValue<ColumnSchema["timing.transfer"]>("timing.transfer"),
    };
    const latency = row.getValue<ColumnSchema["latency"]>("latency");
    const percentage = getTimingPercentage(timing, latency);
    return (
      <HoverCard openDelay={50} closeDelay={50}>
        <HoverCardTrigger
          className="opacity-70 hover:opacity-100 data-[state=open]:opacity-100"
          asChild
        >
          <div className="flex">
            {Object.entries(timing).map(([key, value]) => (
              <div
                key={key}
                className={cn(
                  getTimingColor(key as keyof typeof timing),
                  "h-4",
                )}
                style={{ width: `${(value / latency) * 100}%` }}
              />
            ))}
          </div>
        </HoverCardTrigger>
        <HoverCardPortal>
          <HoverCardContent
            side="bottom"
            align="end"
            className="z-10 w-auto p-2"
          >
            <div className="flex flex-col gap-1">
              {timingPhases.map((phase) => {
                const color = getTimingColor(phase);
                const percentageValue = percentage[phase];
                return (
                  <div key={phase} className="grid grid-cols-2 gap-4 text-xs">
                    <div className="flex items-center gap-2">
                      <div className={cn(color, "h-2 w-2 rounded-full")} />
                      <div className="font-mono uppercase text-accent-foreground">
                        {getTimingLabel(phase)}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <div className="font-mono text-muted-foreground">
                        {percentageValue}
                      </div>
                      <div className="font-mono">
                        {new Intl.NumberFormat("en-US", {
                          maximumFractionDigits: 3,
                        }).format(timing[phase])}
                        <span className="text-muted-foreground">ms</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </HoverCardContent>
        </HoverCardPortal>
      </HoverCard>
    );
  },
  enableResizing: false,
  size: 130,
  minSize: 130,
  meta: {
    label: "Timing Phases",
  },
};

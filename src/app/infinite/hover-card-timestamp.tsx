"use client";

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";
import { UTCDate } from "@date-fns/utc";
import { format, formatDistanceToNowStrict } from "date-fns";
import { Copy } from "lucide-react";
import { Check } from "lucide-react";
import { useState, type ComponentPropsWithoutRef } from "react";

type HoverCardContentProps = ComponentPropsWithoutRef<typeof HoverCardContent>;

interface HoverCardTimestampProps {
  date: Date;
  side?: HoverCardContentProps["side"];
  sideOffset?: HoverCardContentProps["sideOffset"];
  align?: HoverCardContentProps["align"];
  alignOffset?: HoverCardContentProps["alignOffset"];
  className?: string;
}

export function HoverCardTimestamp({
  date,
  side = "right",
  align = "start",
  alignOffset = -4,
  sideOffset,
  className,
}: HoverCardTimestampProps) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  console.log({ date });

  return (
    <HoverCard openDelay={0} closeDelay={0}>
      <HoverCardTrigger asChild>
        <div className={cn("font-mono whitespace-nowrap", className)}>
          {format(date, "LLL dd, y HH:mm:ss")}
        </div>
      </HoverCardTrigger>
      <HoverCardContent
        className="p-2 w-auto z-10"
        {...{ side, align, alignOffset, sideOffset }}
      >
        <dl className="flex flex-col gap-1">
          <Row value={String(date.getTime())} label="Timestamp" />
          <Row
            value={format(new UTCDate(date), "LLL dd, y HH:mm:ss")}
            label="UTC"
          />
          <Row value={format(date, "LLL dd, y HH:mm:ss")} label={timezone} />
          <Row
            value={formatDistanceToNowStrict(date, { addSuffix: true })}
            label="Relative"
          />
        </dl>
      </HoverCardContent>
    </HoverCard>
  );
}

function Row({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div
      className="group flex gap-4 text-sm justify-between items-center"
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-mono truncate flex items-center gap-1">
        <span className="invisible group-hover:visible">
          {!copied ? (
            <Copy className="h-3 w-3" />
          ) : (
            <Check className="h-3 w-3" />
          )}
        </span>
        {value}
      </dd>
    </div>
  );
}

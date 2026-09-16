import {
  TOOLTIP_DELAY,
  TOOLTIP_NOT_HOVERABLE,
} from "@dtf/registry/components/data-table/ui-compat";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@dtf/registry/components/ui/tooltip";
import { cn } from "@dtf/registry/lib/utils";
import React, { useEffect, useRef, useState } from "react";

interface TextWithTooltipProps {
  text: string | number;
  className?: string;
  style?: React.CSSProperties;
}

export function TextWithTooltip({
  text,
  className,
  style,
}: TextWithTooltipProps) {
  const [isTruncated, setIsTruncated] = useState<boolean>(false);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkTruncation = () => {
      if (textRef.current) {
        const { scrollWidth, clientWidth } = textRef.current;
        setIsTruncated(scrollWidth > clientWidth);
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      checkTruncation();
    });

    if (textRef.current) {
      resizeObserver.observe(textRef.current);
    }

    checkTruncation();

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <TooltipProvider {...TOOLTIP_DELAY}>
      <Tooltip {...TOOLTIP_NOT_HOVERABLE}>
        <TooltipTrigger disabled={!isTruncated} asChild>
          <div
            ref={textRef}
            className={cn(
              "truncate",
              !isTruncated && "pointer-events-none",
              className,
            )}
            style={style}
          >
            {text}
          </div>
        </TooltipTrigger>
        <TooltipContent>{text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

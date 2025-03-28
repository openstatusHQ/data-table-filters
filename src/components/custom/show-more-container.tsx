// TODO:
"use client";

import { Button } from "@/components/ui/button";
import { composeRefs } from "@/lib/compose-refs";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";
import * as React from "react";

export interface ShowMoreContainerProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * If set and the content exceeds the maximum height,
   * a "Show content" button will collapse the full content
   */
  maxHeight: number;
}

export const ShowMoreContainer = React.forwardRef<
  HTMLDivElement,
  ShowMoreContainerProps
>(({ children, maxHeight, className, style, ...props }, ref) => {
  const [open, setOpen] = React.useState(false);
  const [collapsible, setCollapsible] = React.useState(true);
  const innerRef = React.useRef<HTMLDivElement>(null);

  React.useLayoutEffect(() => {
    const node = innerRef.current;
    if (node && maxHeight) {
      // REMINDER: scrollHeight will keep the max possible height of the content
      // if maxHeight is set, we show the button by default and remove it if height is too narrow.
      // That way, we avoid having a layout shift of first showing the full height and then collapsible.
      if (node.scrollHeight <= maxHeight) {
        setCollapsible(false);
      }
    }
  }, [maxHeight]);

  return (
    <div
      className={cn("relative", className)}
      style={
        {
          "--max-height": `${maxHeight}px`,
          ...style,
        } as React.CSSProperties
      }
      {...props}
    >
      <div
        className={cn(
          collapsible && !open ? "max-h-[var(--max-height)]" : undefined,
        )}
        ref={composeRefs(ref, innerRef)}
      >
        {children}
      </div>
      {collapsible && !open ? (
        <div className="absolute inset-x-0 bottom-2 flex items-center justify-center">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => setOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" /> Show content
          </Button>
        </div>
      ) : null}
    </div>
  );
});

ShowMoreContainer.displayName = "ShowMoreContainer";

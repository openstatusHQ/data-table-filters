"use client";

import { Button } from "@/components/ui/button";
import { useCopyToClipboard } from "@dtf/registry/hooks/use-copy-to-clipboard";
import { cn } from "@/lib/utils";
import { cva, VariantProps } from "class-variance-authority";
import { Check, Copy, Plus } from "lucide-react";
import * as React from "react";

const containerVariants = cva(
  "peer rounded-md border p-2 font-mono text-sm break-all whitespace-pre-wrap",
  {
    variants: {
      variant: {
        default: "border-border/50 bg-border/30",
        destructive: "border-destructive/50 bg-destructive/30",
      },
      defaultVariants: {
        variant: "default",
      },
    },
  },
);

export interface CopyToClipboardContainerProps
  extends React.ComponentProps<"div">,
    VariantProps<typeof containerVariants> {
  /**
   * If set and the content exceeds the maximum height,
   * a "Show content" button will collapse the full content
   */
  maxHeight?: number;
}

export function CopyToClipboardContainer({
  children,
  variant,
  maxHeight,
  className,
  ref,
  ...props
}: CopyToClipboardContainerProps) {
  const [open, setOpen] = React.useState(false);
  const [collapsible, setCollapsible] = React.useState(!!maxHeight);
  const innerRef = React.useRef<HTMLDivElement>(null);
  const { copy, isCopied } = useCopyToClipboard();

  React.useLayoutEffect(() => {
    if (innerRef.current && maxHeight) {
      // REMINDER: scrollHeight will keep the max possible height of the content
      // if maxHeight is set, we show the button by default and remove it if height is too narrow.
      // That way, we avoid having a layout shift of first showing the full height and then collapsible.
      if (innerRef.current.scrollHeight <= maxHeight) {
        setCollapsible(false);
      }
    }
  }, [maxHeight]);

  return (
    <div
      className="group relative text-left"
      style={
        {
          "--max-height": `${maxHeight}px`,
        } as React.CSSProperties
      }
    >
      <div
        ref={innerRef}
        className={cn(
          containerVariants({ variant }),
          collapsible && !open
            ? "max-h-(--max-height) overflow-hidden"
            : undefined,
          className,
        )}
        {...props}
      >
        {children}
      </div>
      <Button
        variant="outline"
        size="icon"
        className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 peer-focus:opacity-100 focus:opacity-100"
        onClick={() => {
          const content = innerRef.current?.textContent;
          if (content) copy(content);
        }}
      >
        {!isCopied ? (
          <Copy className="h-3 w-3" />
        ) : (
          <Check className="h-3 w-3" />
        )}
      </Button>
      {collapsible && !open ? (
        <div className="from-background/0 to-background absolute inset-x-px bottom-px flex items-center justify-center rounded-b-md bg-linear-to-b">
          <Button
            variant="outline"
            className="my-1 rounded-full"
            onClick={() => setOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" /> Show content
          </Button>
        </div>
      ) : null}
    </div>
  );
}

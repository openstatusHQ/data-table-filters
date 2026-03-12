// Copy Pasta from: https://github.com/sadmann7/shadcn-table/blob/main/src/components/kbd.tsx#L54
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

export const kbdVariants = cva(
  "rounded border px-1.5 py-px font-mono text-[0.7rem] font-normal shadow-xs select-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-accent text-accent-foreground",
        outline: "bg-background text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface KbdProps
  extends React.ComponentProps<"kbd">,
    VariantProps<typeof kbdVariants> {
  /**
   * The title of the `abbr` element inside the `kbd` element.
   * @default undefined
   * @type string | undefined
   * @example title="Command"
   */
  abbrTitle?: string;
}

function Kbd({ abbrTitle, children, className, variant, ...props }: KbdProps) {
  return (
    <kbd className={cn(kbdVariants({ variant, className }))} {...props}>
      {abbrTitle ? (
        <abbr title={abbrTitle} className="no-underline">
          {children}
        </abbr>
      ) : (
        children
      )}
    </kbd>
  );
}

export { Kbd };

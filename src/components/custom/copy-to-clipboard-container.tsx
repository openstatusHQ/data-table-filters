import { Button } from "@/components/ui/button";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { composeRefs } from "@/lib/compose-refs";
import { cn } from "@/lib/utils";
import { cva, VariantProps } from "class-variance-authority";
import { Check, Copy } from "lucide-react";
import * as React from "react";

const containerVariants = cva(
  "peer whitespace-pre-wrap break-all rounded-md border p-2 font-mono text-sm",
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
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof containerVariants> {}

export const CopyToClipboardContainer = React.forwardRef<
  HTMLDivElement,
  CopyToClipboardContainerProps
>(({ children, variant, className, ...props }, ref) => {
  const innerRef = React.useRef<HTMLDivElement>(null);
  const { copy, isCopied } = useCopyToClipboard();

  const onClick = () => {
    const content = innerRef.current?.textContent;
    if (content) copy(content);
  };

  return (
    <div className="group relative text-left">
      <div
        ref={composeRefs(ref, innerRef)}
        className={cn(containerVariants({ variant }), className)}
        {...props}
      >
        {children}
      </div>
      <Button
        variant="outline"
        size="icon"
        className="absolute right-2 top-2 h-6 w-6 opacity-0 focus:opacity-100 group-hover:opacity-100 peer-focus:opacity-100"
        onClick={onClick}
      >
        {!isCopied ? (
          <Copy className="h-3 w-3" />
        ) : (
          <Check className="h-3 w-3" />
        )}
      </Button>
    </div>
  );
});

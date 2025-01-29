import * as React from "react";
import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { composeRefs } from "@/lib/compose-refs";

const CopyToClipboardContainer = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ children, className, ...props }, ref) => {
  const innerRef = React.useRef<HTMLDivElement>(null);
  const { copy, isCopied } = useCopyToClipboard();

  const onClick = () => {
    const content = innerRef.current?.textContent;
    if (content) copy(content);
  };

  return (
    <div className="relative group text-left">
      <div
        ref={composeRefs(ref, innerRef)}
        className={cn("peer", className)}
        {...props}
      >
        {children}
      </div>
      <Button
        variant="outline"
        size="icon"
        className="absolute top-2 right-2 w-6 h-6 opacity-0 group-hover:opacity-100 peer-focus:opacity-100 focus:opacity-100"
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

CopyToClipboardContainer.displayName = "CopyToClipboardContainer";

export default CopyToClipboardContainer;

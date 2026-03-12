"use client";

import { Check, Copy } from "lucide-react";
import { useCallback, useState } from "react";

export function CopyButton({ text }: { text: string }) {
  const [isCopied, setIsCopied] = useState(false);

  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  }, [text]);

  return (
    <button
      onClick={copy}
      aria-label="Copy code to clipboard"
      className="text-muted-foreground hover:bg-muted hover:text-foreground absolute top-4 right-4 rounded-md p-1.5 backdrop-blur-sm transition-colors"
    >
      {isCopied ? <Check className="size-4" /> : <Copy className="size-4" />}
    </button>
  );
}

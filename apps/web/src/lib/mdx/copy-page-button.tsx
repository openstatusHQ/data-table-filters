"use client";

import { Button } from "@/components/ui/button";
import { Check, Copy, FileText } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import { toast } from "sonner";

/**
 * Hands the page to an agent in the format it wants: the markdown source
 * rather than the rendered DOM.
 */
export function CopyPageButton({ slug }: { slug: string }) {
  const [isCopied, setIsCopied] = useState(false);

  const copy = useCallback(async () => {
    try {
      const response = await fetch(`/docs/${slug}.md`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await navigator.clipboard.writeText(await response.text());
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      toast.error("Could not copy this page as markdown");
    }
  }, [slug]);

  return (
    <div className="not-prose flex items-center gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={copy}
        className="text-muted-foreground gap-1.5"
      >
        {isCopied ? (
          <Check className="size-3.5" />
        ) : (
          <Copy className="size-3.5" />
        )}
        {isCopied ? "Copied" : "Copy as markdown"}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        asChild
        className="text-muted-foreground gap-1.5"
      >
        <Link href={`/docs/${slug}.md`} prefetch={false}>
          <FileText className="size-3.5" />
          View raw
        </Link>
      </Button>
    </div>
  );
}

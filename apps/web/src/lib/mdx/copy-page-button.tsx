"use client";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Check, ChevronDown, Copy, ExternalLink, Link2 } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

/**
 * Writes to the clipboard without losing the user gesture.
 *
 * Safari revokes clipboard permission once an `await` has run since the click,
 * so `writeText(await fetch(...))` throws NotAllowedError there. Handing
 * `ClipboardItem` the unresolved promise keeps the write attached to the click;
 * browsers without `clipboard.write` fall back to the plain path.
 */
async function copyFromRequest(url: string): Promise<void> {
  const fetchText = async () => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.text();
  };

  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    const blob = fetchText().then(
      (text) => new Blob([text], { type: "text/plain" }),
    );
    await navigator.clipboard.write([
      new ClipboardItem({ "text/plain": blob }),
    ]);
    return;
  }

  await navigator.clipboard.writeText(await fetchText());
}

/**
 * Hands the page to an agent in the format it wants: the markdown source
 * rather than the rendered DOM.
 */
export function CopyPageButton({ slug }: { slug: string }) {
  const [isCopied, setIsCopied] = useState(false);

  const flashCopied = useCallback(() => {
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  }, []);

  const copyMarkdown = useCallback(async () => {
    try {
      await copyFromRequest(`/docs/${slug}.md`);
      flashCopied();
    } catch {
      toast.error("Could not copy this page as markdown");
    }
  }, [slug, flashCopied]);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy the link");
    }
  }, []);

  return (
    <ButtonGroup className="not-prose">
      <Button
        variant="outline"
        size="sm"
        onClick={copyMarkdown}
        className="text-muted-foreground gap-1.5"
      >
        {isCopied ? (
          <Check className="size-3.5" />
        ) : (
          <Copy className="size-3.5" />
        )}
        {isCopied ? "Copied" : "Copy page"}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="text-muted-foreground px-2"
            aria-label="More copy options"
          >
            <ChevronDown className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onSelect={copyMarkdown}>
            <Copy className="size-3.5" />
            Copy as Markdown
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={copyLink}>
            <Link2 className="size-3.5" />
            Copy link
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <a href={`/docs/${slug}.md`} target="_blank" rel="noreferrer">
              <ExternalLink className="size-3.5" />
              View as Markdown
            </a>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </ButtonGroup>
  );
}

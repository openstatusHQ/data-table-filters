import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

export default function MDXLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="container mx-auto px-4 py-8">
      <Button asChild variant="link" className="-ml-4">
        <Link href="/">
          <ChevronLeft className="mr-2 h-4 w-4" /> Back
        </Link>
      </Button>
      <Separator className="my-6" />
      <div
        className={cn(
          "prose prose-lg mx-auto dark:prose-invert",
          "prose-pre:bg-foreground dark:prose-pre:bg-muted/50",
          "prose-figure:rounded-lg prose-figure:border prose-figure:border-border",
          "prose-blockquote:rounded-lg prose-blockquote:border prose-blockquote:border-border prose-blockquote:bg-muted/50 prose-blockquote:pe-6 prose-blockquote:font-normal prose-blockquote:not-italic",
        )}
      >
        {children}
      </div>
    </main>
  );
}

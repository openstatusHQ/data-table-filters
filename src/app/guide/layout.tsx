import { cn } from "@/lib/utils";

export default function MDXLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="container mx-auto px-4 py-8">
      <div
        className={cn(
          "prose dark:prose-invert prose-lg",
          "prose-pre:bg-foreground dark:prose-pre:bg-muted/50",
          "prose-figure:border prose-figure:border-border prose-figure:rounded-lg"
        )}
      >
        {children}
      </div>
    </main>
  );
}

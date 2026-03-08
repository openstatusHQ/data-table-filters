import { getContent, Mdx, TableOfContents } from "@/lib/mdx";
import { cn } from "@/lib/utils";

export default async function GuidePage() {
  const { source, headings } = await getContent("guide");
  return (
    <div className="relative mx-auto max-w-5xl lg:grid lg:grid-cols-[1fr_220px] lg:gap-8">
      <div
        className={cn(
          "prose prose-lg dark:prose-invert",
          "prose-pre:bg-foreground dark:prose-pre:bg-muted/50",
          "prose-figure:rounded-lg prose-figure:border prose-figure:border-border",
          "prose-blockquote:rounded-lg prose-blockquote:border prose-blockquote:border-border prose-blockquote:bg-muted/50 prose-blockquote:pe-6 prose-blockquote:font-normal prose-blockquote:not-italic",
        )}
      >
        <Mdx source={source} />
      </div>
      <TableOfContents headings={headings} />
    </div>
  );
}

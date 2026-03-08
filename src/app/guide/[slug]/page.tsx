import { getAllSections, getSection, Mdx, TableOfContents } from "@/lib/mdx";
import { cn } from "@/lib/utils";
import { notFound } from "next/navigation";

export async function generateStaticParams() {
  const sections = await getAllSections("guide");
  return sections.map((s) => ({ slug: s.slug }));
}

export default async function GuideSectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const section = await getSection("guide", slug);
  if (!section) notFound();
  const { source, headings } = section;

  return (
    <>
      <div
        className={cn(
          "prose prose-lg dark:prose-invert",
          "prose-pre:bg-foreground dark:prose-pre:bg-muted/50",
          "prose-figure:rounded-lg prose-figure:border prose-figure:border-border",
          "prose-blockquote:rounded-lg prose-blockquote:border prose-blockquote:border-border prose-blockquote:bg-muted/50 prose-blockquote:pe-6 prose-blockquote:font-normal prose-blockquote:not-italic",
          "prose-h1:font-semibold prose-h2:font-semibold prose-h3:font-semibold prose-h4:font-semibold prose-h5:font-semibold prose-h6:font-semibold",
          "w-full min-w-0",
        )}
      >
        <Mdx source={source} />
      </div>
      <TableOfContents headings={headings} />
    </>
  );
}

import { getAllSections, getSection, Mdx, TableOfContents } from "@/lib/mdx";
import { ogMetadata, twitterMetadata } from "@/lib/metadata/shared-metadata";
import { cn } from "@/lib/utils";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export async function generateStaticParams() {
  const sections = await getAllSections("docs");
  return sections.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata | undefined> {
  const { slug } = await params;
  const section = await getSection("docs", slug);
  if (!section) return;

  const { title, description } = section.meta;

  return {
    title,
    description,
    twitter: { ...twitterMetadata, title, description },
    openGraph: { ...ogMetadata, title, description },
    alternates: { canonical: `/docs/${slug}` },
  };
}

export default async function DocsSectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const section = await getSection("docs", slug);
  if (!section) notFound();
  const { source, headings } = section;

  return (
    <>
      <div
        className={cn(
          "prose prose-lg dark:prose-invert",
          "prose-pre:rounded-lg prose-pre:border prose-pre:border-border prose-pre:bg-foreground dark:prose-pre:bg-muted/50",
          "prose-blockquote:rounded-lg prose-blockquote:border prose-blockquote:border-border prose-blockquote:bg-muted/50 prose-blockquote:pe-6 prose-blockquote:font-normal prose-blockquote:not-italic",
          "w-full min-w-0 overflow-x-auto",
          "prose-h1:font-semibold prose-h2:font-semibold prose-h3:font-semibold prose-h4:font-semibold prose-h5:font-semibold prose-h6:font-semibold",
        )}
      >
        <Mdx source={source} />
      </div>
      <TableOfContents headings={headings} />
    </>
  );
}

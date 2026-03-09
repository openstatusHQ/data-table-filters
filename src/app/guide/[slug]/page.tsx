import { getAllSections, getSection, Mdx, TableOfContents } from "@/lib/mdx";
import { ogMetadata, twitterMetadata } from "@/lib/metadata/shared-metadata";
import { cn } from "@/lib/utils";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export async function generateStaticParams() {
  const sections = await getAllSections("guide");
  return sections.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata | undefined> {
  const { slug } = await params;
  const section = await getSection("guide", slug);
  if (!section) return;

  const { title, description } = section.meta;

  return {
    title,
    description,
    twitter: { ...twitterMetadata, title, description },
    openGraph: { ...ogMetadata, title, description },
    alternates: { canonical: `/guide/${slug}` },
  };
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
          "w-full min-w-0 overflow-x-auto",
        )}
      >
        <Mdx source={source} />
      </div>
      <TableOfContents headings={headings} />
    </>
  );
}

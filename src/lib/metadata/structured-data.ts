import type { SectionMeta } from "@/lib/mdx/get-content";
import type {
  BlogPosting,
  BreadcrumbList,
  FAQPage,
  Organization,
  WebPage,
  WithContext,
} from "schema-dts";
import { BASE_URL } from "./shared-metadata";

export function getJsonLDOrganization(): WithContext<Organization> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "openstatus",
    url: BASE_URL,
    logo: `${BASE_URL}/assets/data-table-infinite.png`,
  };
}

export function getJsonLDWebPage(meta: SectionMeta): WithContext<WebPage> {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: meta.title,
    description: meta.description,
    url: `${BASE_URL}/docs/${meta.slug}`,
  };
}

export function getJsonLDBlogPosting(
  meta: SectionMeta,
  slug: string,
): WithContext<BlogPosting> {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: meta.title,
    description: meta.description,
    author: {
      "@type": "Organization",
      name: meta.author,
    },
    datePublished: meta.publishedAt,
    url: `${BASE_URL}/docs/${slug}`,
  };
}

export function getJsonLDBreadcrumbList(
  items: { name: string; url: string }[],
): WithContext<BreadcrumbList> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem" as const,
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function getJsonLDFAQPage(
  meta: SectionMeta,
): WithContext<FAQPage> | null {
  if (!meta.faq || meta.faq.length === 0) return null;

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: meta.faq.map((item) => ({
      "@type": "Question" as const,
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer" as const,
        text: item.answer,
      },
    })),
  };
}

export function createJsonLDGraph(items: (Record<string, any> | null)[]) {
  const filtered = items.filter(
    (item): item is Record<string, any> => item !== null,
  );
  return {
    "@context": "https://schema.org",
    "@graph": filtered.map(({ "@context": _, ...rest }) => rest),
  };
}

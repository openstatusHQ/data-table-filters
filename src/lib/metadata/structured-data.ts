import type { SectionMeta } from "@/lib/mdx/get-content";
import type {
  BlogPosting,
  BreadcrumbList,
  FAQPage,
  Organization,
  SoftwareApplication,
  WebPage,
  WithContext,
} from "schema-dts";
import { BASE_URL, DESCRIPTION } from "./shared-metadata";

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

export function getJsonLDSoftwareApplication(): WithContext<SoftwareApplication> {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "data-table-filters",
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Any",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    description: DESCRIPTION,
    url: BASE_URL,
    author: {
      "@type": "Organization",
      name: "openstatus",
    },
  };
}

export const HOMEPAGE_FAQS: { question: string; answer: string }[] = [
  {
    question: "What is data-table-filters?",
    answer:
      "data-table-filters is an open-source React data table system built on TanStack Table and shadcn/ui. It provides faceted filters (checkbox, input, slider, time range), sorting, infinite scroll, virtualization, and server-side rendering out of the box.",
  },
  {
    question: "How is this different from other React data table libraries?",
    answer:
      "Unlike libraries like AG Grid or MUI DataGrid, data-table-filters is not a library — it's a set of copy-paste patterns. You install components via the shadcn CLI and own the code. No vendor lock-in, no bundle bloat, full customization.",
  },
  {
    question: "Does it support server-side filtering and sorting?",
    answer:
      "Yes. data-table-filters supports both client-side and server-side filtering with URL-based state management via nuqs. It includes a Drizzle ORM integration for type-safe server-side queries with automatic filter-to-SQL translation.",
  },
  {
    question: "What state management options are available?",
    answer:
      "You can choose between nuqs (URL-based state, shareable links, SSR-compatible) or zustand (client-side, fast, no URL clutter). Both are fully supported with the same filter API.",
  },
];

export function getJsonLDHomepageFAQ(): WithContext<FAQPage> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: HOMEPAGE_FAQS.map((faq) => ({
      "@type": "Question" as const,
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer" as const,
        text: faq.answer,
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

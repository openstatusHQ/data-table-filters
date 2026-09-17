import { CREATE_PROJECT_COMMAND } from "@/lib/llms/blocks";
import type { SectionMeta } from "@/lib/mdx/get-content";
import type {
  BlogPosting,
  BreadcrumbList,
  FAQPage,
  HowTo,
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
    // Where and how it is installed: the CLI is the distribution, and the
    // one-command first run is the fastest way in.
    installUrl: `${BASE_URL}/docs/quick-start`,
    softwareRequirements:
      "Node.js and a React project with Tailwind CSS v4 and shadcn/ui, on either component library (Base UI or Radix). Installed as source with the shadcn CLI.",
    softwareHelp: {
      "@type": "CreativeWork",
      url: `${BASE_URL}/docs`,
    },
    author: {
      "@type": "Organization",
      name: "openstatus",
    },
  };
}

/** The steps of the one-command first run, in the words the page uses. */
export const CREATE_PROJECT_STEPS: { name: string; text: string }[] = [
  {
    name: "Create the project",
    text: `Run ${CREATE_PROJECT_COMMAND}. The shadcn CLI creates a Next.js app, initializes shadcn on Base UI, and installs the data-table-example-infinite block with every block it depends on. Add -b radix before -p nova for Radix.`,
  },
  {
    name: "Start the dev server",
    text: "Run cd data-table-app && npm run dev.",
  },
  {
    name: "Open the example",
    text: "Open http://localhost:3000/example: a table over 5,000 mock rows with a timeline chart, filters, facet counts, infinite scroll, a command palette and a row sheet. It lives in app/example; edit app/example/table-schema.ts to change the columns.",
  },
];

/**
 * The "start from scratch" path as a HowTo, so a search engine or an agent
 * reading the page's structured data gets the command itself, not a summary
 * of it. Carried by the Quick Start only, where the steps are visible on the
 * page; the homepage has the command but not the steps.
 */
export function getJsonLDCreateProjectHowTo(): WithContext<HowTo> {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "Create a shadcn project with a data table from scratch",
    description:
      "One shadcn CLI command scaffolds a Next.js app, initializes shadcn/ui, and installs a working data table example with filters, facet counts, a timeline chart and infinite scroll.",
    totalTime: "PT2M",
    tool: [{ "@type": "HowToTool", name: "shadcn CLI (npx shadcn@latest)" }],
    step: CREATE_PROJECT_STEPS.map((step, index) => ({
      "@type": "HowToStep" as const,
      position: index + 1,
      name: step.name,
      text: step.text,
      url: `${BASE_URL}/docs/quick-start#start-from-scratch`,
    })),
  };
}

export const HOMEPAGE_FAQS: { question: string; answer: string }[] = [
  {
    question: "How do I start a new project with a data table from scratch?",
    answer: `Run ${CREATE_PROJECT_COMMAND}. The shadcn CLI creates the Next.js app, initializes shadcn, and installs a working example route with every block it needs. Then cd data-table-app, npm run dev, and open http://localhost:3000/example. Add -b radix before -p nova for Radix.`,
  },
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
  {
    question: "Can AI agents build data tables with this?",
    answer:
      "Yes. data-table-filters ships with an AI agent skill that understands the full project structure and can scaffold, configure, and extend data tables end-to-end. Because every component is installed via the shadcn CLI, agents know exactly how to add and compose pieces without custom tooling. It also includes an MCP server that lets AI assistants query and filter your actual table data directly.",
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

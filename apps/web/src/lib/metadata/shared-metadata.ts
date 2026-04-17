import type { Metadata } from "next";

export const TITLE =
  "React Data Table with Filters — shadcn/ui + TanStack Table | openstatus";
export const DESCRIPTION =
  "Open-source React data table with faceted filters, sorting, infinite scroll, and server-side rendering. Built on TanStack Table and shadcn/ui with nuqs or zustand state management. Install via CLI — no library lock-in.";
export const BASE_URL = "https://data-table.openstatus.dev";

const images = ["/assets/data-table-infinite.png"];

export const twitterMetadata: Metadata["twitter"] = {
  images,
  card: "summary_large_image",
  title: TITLE,
  description: DESCRIPTION,
};

export const ogMetadata: Metadata["openGraph"] = {
  type: "website",
  url: BASE_URL,
  images,
  title: TITLE,
  description: DESCRIPTION,
};

export const defaultMetadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: TITLE,
    template: "%s | Data Table",
  },
  description: DESCRIPTION,
  keywords: [
    "react data table",
    "shadcn data table",
    "react data table with filters",
    "tanstack table filters",
    "shadcn data table filters",
    "next.js data table",
    "react server side data table",
    "react data table infinite scroll",
  ],
  alternates: { canonical: "/" },
};

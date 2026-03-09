import type { Metadata } from "next";

export const TITLE = "Powerful Data-Table for React | openstatus";
export const DESCRIPTION =
  "Flexible, fast, and easy-to-use filters with tanstack table, shadcn/ui and state management via nuqs or zustand. Fully open source on GitHub.";
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
};

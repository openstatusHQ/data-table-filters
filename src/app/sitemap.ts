import { getAllSections } from "@/lib/mdx/get-content";
import type { MetadataRoute } from "next";

const BASE_URL = "https://data-table.openstatus.dev";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const docs = await getAllSections("docs");

  const docPages = docs.map((doc) => ({
    url: `${BASE_URL}/docs/${doc.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  const demoPages = [
    "/infinite",
    "/default",
    "/drizzle",
    "/builder",
    "/auto",
    "/light",
  ].map((path) => ({
    url: `${BASE_URL}${path}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    ...demoPages,
    ...docPages,
  ];
}

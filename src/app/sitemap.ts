import { getAllSections } from "@/lib/mdx/get-content";
import { BASE_URL } from "@/lib/metadata/shared-metadata";
import type { MetadataRoute } from "next";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const docs = await getAllSections("docs");

  const docPages = docs.map((doc) => ({
    url: `${BASE_URL}/docs/${doc.slug}`,
    lastModified: doc.publishedAt ? new Date(doc.publishedAt) : new Date(),
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

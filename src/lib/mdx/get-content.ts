import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";

export type TOCItem = { depth: number; text: string; slug: string };

export type SectionMeta = {
  title: string;
  description: string;
  slug: string;
  order: number;
};

export function slugify(str: string) {
  return str
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/&/g, "-and-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-");
}

function extractHeadings(source: string): TOCItem[] {
  const headings: TOCItem[] = [];
  const regex = /^(#{2,4})\s+(.+)$/gm;
  let match;
  while ((match = regex.exec(source)) !== null) {
    headings.push({
      depth: match[1].length,
      text: match[2],
      slug: slugify(match[2]),
    });
  }
  return headings;
}

function parseFilename(filename: string): { order: number; slug: string } {
  const stem = filename.replace(/\.mdx$/, "");
  const dashIndex = stem.indexOf("-");
  return {
    order: Number(stem.slice(0, dashIndex)),
    slug: stem.slice(dashIndex + 1),
  };
}

export async function getAllSections(
  directory: string,
): Promise<SectionMeta[]> {
  const dirPath = path.join(process.cwd(), `src/content/${directory}`);
  const files = await fs.readdir(dirPath);
  const mdxFiles = files.filter((f) => f.endsWith(".mdx"));

  const sections: SectionMeta[] = [];

  for (const file of mdxFiles) {
    const { order, slug } = parseFilename(file);
    const raw = await fs.readFile(path.join(dirPath, file), "utf-8");
    const { data } = matter(raw);
    sections.push({
      title: data.title,
      description: data.description,
      slug,
      order,
    });
  }

  return sections.sort((a, b) => a.order - b.order);
}

export async function getSection(
  directory: string,
  slug: string,
): Promise<{ source: string; headings: TOCItem[]; meta: SectionMeta } | null> {
  const dirPath = path.join(process.cwd(), `src/content/${directory}`);
  const files = await fs.readdir(dirPath);
  const file = files.find(
    (f) => f.endsWith(".mdx") && parseFilename(f).slug === slug,
  );

  if (!file) return null;

  const { order } = parseFilename(file);
  const raw = await fs.readFile(path.join(dirPath, file), "utf-8");
  const { data, content } = matter(raw);
  const headings = extractHeadings(content);

  return {
    source: content,
    headings,
    meta: {
      title: data.title,
      description: data.description,
      slug,
      order,
    },
  };
}

import fs from "fs/promises";
import path from "path";

export type TOCItem = { depth: number; text: string; slug: string };

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

export async function getContent(slug: string): Promise<{
  source: string;
  headings: TOCItem[];
}> {
  const filePath = path.join(process.cwd(), `src/app/${slug}/content.mdx`);
  const source = await fs.readFile(filePath, "utf-8");
  const headings = extractHeadings(source);
  return { source, headings };
}

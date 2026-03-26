import fs from "fs/promises";
import path from "path";
import { slugify } from "@/lib/mdx/get-content";
import matter from "gray-matter";
import sanitizeHtml from "sanitize-html";

const WORDS_BEFORE = 2;
const WORDS_AFTER = 20;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query) {
    return Response.json([]);
  }

  const dirPath = path.join(process.cwd(), "src/content/docs");
  const files = await fs.readdir(dirPath);
  const mdxFiles = files.filter((f) => f.endsWith(".mdx"));

  const results: {
    title: string;
    slug: string;
    href: string;
    content: string;
  }[] = [];

  for (const file of mdxFiles) {
    const stem = file.replace(/\.mdx$/, "");
    const dashIndex = stem.indexOf("-");
    const slug = stem.slice(dashIndex + 1);

    const raw = await fs.readFile(path.join(dirPath, file), "utf-8");
    const { data, content } = matter(raw);
    const title = data.title as string;

    const searchLower = query.toLowerCase();
    const hasTitle = title.toLowerCase().includes(searchLower);
    const sanitizedContent = sanitizeContent(content);
    const hasContent = sanitizedContent.toLowerCase().includes(searchLower);

    if (!hasTitle && !hasContent) continue;

    let href = `/docs/${slug}`;

    if (query) {
      href = `${href}?q=${encodeURIComponent(query)}`;
    }

    if (hasContent) {
      const headingSlug = findClosestHeading(content, query);
      if (headingSlug) {
        href = `${href}#${headingSlug}`;
      }
    }

    const snippet = hasContent
      ? getContentSnippet(sanitizedContent, query)
      : "";

    results.push({ title, slug, href, content: snippet });
  }

  return Response.json(results);
}

function sanitizeContent(input: string) {
  return sanitizeHtml(input)
    .replace(/<[^>]+>/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/!\[.*?\]\(.*?\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    .replace(/[`*>~]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[<>]/g, (c) => (c === "<" ? "&lt;" : "&gt;"))
    .trim();
}

function getContentSnippet(content: string, searchQuery: string): string {
  const contentLower = content.toLowerCase();
  const searchLower = searchQuery.toLowerCase();
  const matchIndex = contentLower.indexOf(searchLower);

  if (matchIndex === -1) {
    return `${content.slice(0, 100)}...`;
  }

  let start = matchIndex;
  for (let i = 0; i < WORDS_BEFORE && start > 0; i++) {
    const prevSpace = content.lastIndexOf(" ", start - 2);
    if (prevSpace === -1) break;
    start = prevSpace + 1;
  }

  let end = matchIndex + searchQuery.length;
  for (let i = 0; i < WORDS_AFTER && end < content.length; i++) {
    const nextSpace = content.indexOf(" ", end + 1);
    if (nextSpace === -1) {
      end = content.length;
      break;
    }
    end = nextSpace;
  }

  let snippet = content.slice(start, end).trim();
  if (!snippet) return snippet;
  if (start > 0) snippet = `...${snippet}`;
  if (end < content.length) snippet = `${snippet}...`;

  return snippet;
}

function findClosestHeading(
  mdxContent: string,
  searchQuery: string,
): string | null {
  const searchLower = searchQuery.toLowerCase();
  const contentLower = mdxContent.toLowerCase();
  const matchIndex = contentLower.indexOf(searchLower);

  if (matchIndex === -1) return null;

  const contentBeforeMatch = mdxContent.slice(0, matchIndex);
  const headingRegex = /^#{1,6}\s+(.+)$/gm;
  const headings: { text: string }[] = [];

  let match = headingRegex.exec(contentBeforeMatch);
  while (match !== null) {
    headings.push({ text: match[1].trim() });
    match = headingRegex.exec(contentBeforeMatch);
  }

  if (headings.length > 0) {
    return slugify(headings[headings.length - 1].text);
  }

  return null;
}

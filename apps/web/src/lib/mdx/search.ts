import type { SectionMeta } from "./get-content";
import { slugify } from "./slugify";

/**
 * Lexical search over the docs. One implementation, two front ends: the ⌘K
 * palette (`/docs/api/search`) and the MCP server's `search_docs` tool. They
 * ask the same corpus the same question, so they cannot disagree about the
 * answer.
 *
 * Deliberately not an embedding index: the corpus is ~25k tokens of prose whose
 * vocabulary the reader already has, and a deterministic scorer can be tested,
 * needs no build step, and cannot go stale against the content.
 *
 * Results are sections rather than pages, so a hit points at the part that
 * answers the question. Callers build their own URLs from `slug` + `anchor`.
 */

export type DocSection = {
  /** Docs page this came from. */
  slug: string;
  /** Page title, from frontmatter. */
  title: string;
  /** Heading this section sits under, or null for the page's opening text. */
  heading: string | null;
  /** Anchor for `heading`, matching the ids the docs page renders. */
  anchor: string | null;
  body: string;
};

export type SearchResult = {
  slug: string;
  title: string;
  heading: string | null;
  /** Anchor of the matching section, for `#`-linking into the page. */
  anchor: string | null;
  score: number;
  snippet: string;
};

export type SearchOptions = {
  /** Results to return. */
  limit?: number;
  /**
   * Collapse to the best-scoring section per page. The palette lists pages, so
   * three hits on one page should be one row; the MCP tool wants them all.
   */
  onePerPage?: boolean;
};

/**
 * Words that match everything and rank nothing.
 *
 * Includes the filler verbs of a question — "how does X work", "what do I need"
 * — because scoring them dilutes the coverage bonus for the terms that carry
 * the actual subject.
 */
const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "can",
  "do",
  "does",
  "for",
  "from",
  "how",
  "i",
  "in",
  "is",
  "it",
  "make",
  "my",
  "need",
  "of",
  "on",
  "or",
  "should",
  "the",
  "to",
  "use",
  "using",
  "want",
  "what",
  "when",
  "where",
  "which",
  "why",
  "with",
  "work",
  "works",
]);

const SNIPPET_LENGTH = 240;

/** Query terms worth scoring — keeps `@`, `.`, `-` so `col.string` survives. */
export function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9.@_-]+/)
    .map((token) => token.replace(/^[.-]+|[.-]+$/g, ""))
    .filter((token) => token.length > 1 && !STOPWORDS.has(token));
}

/**
 * One section per heading, so a hit points at the part of the page that
 * answers the question rather than at 400 lines of prose.
 */
export function splitIntoSections(
  meta: SectionMeta,
  source: string,
): DocSection[] {
  const sections: DocSection[] = [];
  let heading: string | null = null;
  let body: string[] = [];
  let inFence = false;

  const push = () => {
    const text = body.join("\n").trim();
    // A heading with nothing under it is a container for the next one.
    if (!text && heading === null) return;
    sections.push({
      slug: meta.slug,
      title: meta.title,
      heading,
      anchor: heading ? slugify(heading) : null,
      body: text,
    });
  };

  for (const line of source.split("\n")) {
    // `#` starts a comment in most of the fenced languages here, so headings
    // are only headings outside a fence.
    if (line.trimStart().startsWith("```")) inFence = !inFence;

    const match = inFence ? null : line.match(/^(#{2,3})\s+(.+?)\s*$/);
    if (!match) {
      body.push(line);
      continue;
    }

    push();
    heading = match[2];
    body = [];
  }
  push();

  return sections;
}

/** Whole-word occurrences of `token` in `text`, both already lowercased. */
function countMatches(text: string, token: string): number {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.match(new RegExp(`(?<![a-z0-9])${escaped}`, "g"))?.length ?? 0;
}

function buildSnippet(body: string, tokens: string[]): string {
  const flat = body.replace(/\s+/g, " ").trim();
  const lowered = flat.toLowerCase();

  const hit = tokens
    .map((token) => lowered.indexOf(token))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];

  if (hit === undefined || flat.length <= SNIPPET_LENGTH) {
    return flat.slice(0, SNIPPET_LENGTH);
  }

  // Start a little before the hit, on a word boundary, so the match has context.
  const start = Math.max(0, hit - 60);
  const wordStart = start === 0 ? 0 : flat.indexOf(" ", start) + 1;
  const snippet = flat.slice(wordStart, wordStart + SNIPPET_LENGTH);

  return `${wordStart > 0 ? "…" : ""}${snippet}${
    wordStart + SNIPPET_LENGTH < flat.length ? "…" : ""
  }`;
}

/**
 * Ranks sections against a query. Headings and titles outweigh body text — a
 * section called "Cursor Pagination" beats one that mentions it in passing —
 * and matching more of the query outweighs matching one term repeatedly.
 */
export function searchDocs(
  sections: DocSection[],
  query: string,
  { limit = 5, onePerPage = false }: SearchOptions = {},
): SearchResult[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  const phrase = query.trim().toLowerCase();

  const scored = sections.map((section) => {
    const heading = (section.heading ?? "").toLowerCase();
    const title = section.title.toLowerCase();
    const body = section.body.toLowerCase();

    let score = 0;
    let matched = 0;

    for (const token of tokens) {
      const inBody = countMatches(body, token);
      const hits =
        countMatches(heading, token) * 8 +
        countMatches(title, token) * 5 +
        Math.min(inBody, 5);

      if (hits > 0) matched += 1;
      score += hits;
    }

    if (matched === 0) return { section, score: 0 };

    // Covering the whole query beats hammering one term.
    score += (matched / tokens.length) * 10;

    // The whole phrase in a heading is what the section is about. The whole
    // phrase in the body might just be a page quoting the question — the docs
    // themselves print example queries — so it counts for much less.
    if (phrase.length > 3) {
      if (heading.includes(phrase)) score += 10;
      else if (body.includes(phrase)) score += 3;
    }

    return { section, score };
  });

  const ranked = scored
    .filter((entry) => entry.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score || a.section.slug.localeCompare(b.section.slug),
    );

  // Already sorted, so the first hit for a page is its best one.
  const kept = onePerPage
    ? ranked.filter(
        (entry, index) =>
          ranked.findIndex(
            (other) => other.section.slug === entry.section.slug,
          ) === index,
      )
    : ranked;

  return kept.slice(0, limit).map(({ section, score }) => ({
    slug: section.slug,
    title: section.title,
    heading: section.heading,
    anchor: section.anchor,
    score: Math.round(score * 10) / 10,
    snippet: buildSnippet(toPlainText(section.body), tokens),
  }));
}

/**
 * Markdown source flattened to readable prose for snippets.
 *
 * Syntax goes, code stays: people search for `createDrizzleHandler` as often as
 * for "server-side filtering", and a snippet that dropped its code fences would
 * hide the very line that matched. Emphasis is only unwrapped in pairs, so
 * `_type` and `snake_case` survive intact.
 */
export function toPlainText(markdown: string): string {
  return markdown
    .replace(/^\s*```[a-z]*\s*$/gim, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[.*?\]\(.*?\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*\|?[\s:|-]{6,}\|?\s*$/gm, " ")
    .replace(/^\s*>\s?/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

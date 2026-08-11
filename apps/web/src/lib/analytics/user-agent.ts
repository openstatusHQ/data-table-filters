export type ClientKind =
  | "coding-agent"
  | "ai-crawler"
  | "cli"
  | "browser"
  | "unknown";

export type ClientClassification = {
  kind: ClientKind;
  /** Normalized client name, e.g. "claude-code", "gptbot", "shadcn". */
  name: string;
};

type Rule = { kind: ClientKind; name: string; match: RegExp };

/**
 * Order matters: the first match wins. Coding agents come first because several
 * of them ship a browser-ish or fetch-ish UA with their own token appended.
 */
const RULES: Rule[] = [
  // Coding agents — a developer is in the loop, being helped by a tool.
  { kind: "coding-agent", name: "claude-code", match: /claude[-_ ]?code/i },
  { kind: "coding-agent", name: "cursor", match: /\bcursor\b/i },
  { kind: "coding-agent", name: "windsurf", match: /windsurf/i },
  { kind: "coding-agent", name: "codex", match: /\bcodex(-cli)?\b/i },
  { kind: "coding-agent", name: "copilot", match: /copilot/i },
  { kind: "coding-agent", name: "aider", match: /\baider\b/i },
  { kind: "coding-agent", name: "cline", match: /\bcline\b/i },
  { kind: "coding-agent", name: "continue", match: /\bcontinue(dev)?\b/i },
  { kind: "coding-agent", name: "zed", match: /\bzed\b/i },
  { kind: "coding-agent", name: "devin", match: /\bdevin\b/i },
  { kind: "coding-agent", name: "opencode", match: /open[-_ ]?code/i },
  { kind: "coding-agent", name: "gemini-cli", match: /gemini[-_ ]?cli/i },

  // AI crawlers — training, retrieval, and answer-engine traffic.
  { kind: "ai-crawler", name: "claudebot", match: /claude(bot|-web|-user)/i },
  { kind: "ai-crawler", name: "gptbot", match: /gptbot/i },
  { kind: "ai-crawler", name: "chatgpt-user", match: /chatgpt-user/i },
  { kind: "ai-crawler", name: "oai-searchbot", match: /oai-searchbot/i },
  { kind: "ai-crawler", name: "perplexity", match: /perplexity/i },
  { kind: "ai-crawler", name: "google-extended", match: /google-extended/i },
  {
    kind: "ai-crawler",
    name: "applebot-extended",
    match: /applebot-extended/i,
  },
  {
    kind: "ai-crawler",
    name: "meta-external",
    match: /meta-external(agent|fetcher)/i,
  },
  { kind: "ai-crawler", name: "bytespider", match: /bytespider/i },
  { kind: "ai-crawler", name: "amazonbot", match: /amazonbot/i },
  { kind: "ai-crawler", name: "duckassistbot", match: /duckassistbot/i },
  {
    kind: "ai-crawler",
    name: "cohere",
    match: /cohere-(ai|training-data-crawler)/i,
  },

  // CLIs — usually `npx shadcn add`, which is what an install actually looks like.
  { kind: "cli", name: "shadcn", match: /shadcn/i },
  { kind: "cli", name: "npm", match: /\bnpm\b|npx/i },
  { kind: "cli", name: "pnpm", match: /pnpm/i },
  { kind: "cli", name: "bun", match: /\bbun\b/i },
  {
    kind: "cli",
    name: "node",
    match: /node-fetch|undici|axios|\bgot\b|^node\b/i,
  },
  { kind: "cli", name: "curl", match: /\bcurl\b/i },
  { kind: "cli", name: "wget", match: /\bwget\b/i },
];

/**
 * Buckets a request's user-agent so registry and docs traffic can be split into
 * "a human read this" vs "a tool fetched this on someone's behalf".
 *
 * Deliberately coarse: user-agent strings are unstable and self-reported, so
 * this is a trend signal, not an audit log.
 */
export function classifyUserAgent(
  userAgent: string | null | undefined,
): ClientClassification {
  if (!userAgent || !userAgent.trim()) {
    // No UA at all is itself a signal — plain fetch() in a script or runtime.
    return { kind: "unknown", name: "none" };
  }

  for (const rule of RULES) {
    if (rule.match.test(userAgent)) {
      return { kind: rule.kind, name: rule.name };
    }
  }

  if (/^mozilla\/5\.0/i.test(userAgent)) {
    return { kind: "browser", name: "browser" };
  }

  return { kind: "unknown", name: "other" };
}

/** True for traffic that represents an AI tool rather than a person. */
export function isAgentTraffic(classification: ClientClassification): boolean {
  return (
    classification.kind === "coding-agent" ||
    classification.kind === "ai-crawler"
  );
}

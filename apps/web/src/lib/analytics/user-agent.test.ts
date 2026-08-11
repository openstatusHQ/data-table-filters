import { describe, expect, it } from "vitest";
import { classifyUserAgent, isAgentTraffic } from "./user-agent";

describe("classifyUserAgent", () => {
  it("recognizes coding agents", () => {
    const cases: [string, string][] = [
      ["claude-code/2.1.0 (external, cli)", "claude-code"],
      ["Cursor/0.45.2", "cursor"],
      ["codex-cli/1.2.3", "codex"],
      ["GitHubCopilotChat/1.0", "copilot"],
      ["aider/0.70.0", "aider"],
      ["gemini-cli/0.3.1", "gemini-cli"],
    ];

    for (const [userAgent, name] of cases) {
      expect(classifyUserAgent(userAgent)).toEqual({
        kind: "coding-agent",
        name,
      });
    }
  });

  it("recognizes AI crawlers", () => {
    const cases: [string, string][] = [
      [
        "Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)",
        "claudebot",
      ],
      ["Mozilla/5.0 AppleWebKit/537.36 (compatible; GPTBot/1.2)", "gptbot"],
      ["Mozilla/5.0 (compatible; PerplexityBot/1.0)", "perplexity"],
      ["Mozilla/5.0 (compatible; meta-externalagent/1.1)", "meta-external"],
    ];

    for (const [userAgent, name] of cases) {
      expect(classifyUserAgent(userAgent)).toEqual({
        kind: "ai-crawler",
        name,
      });
    }
  });

  it("does not mistake ClaudeBot for Claude Code", () => {
    expect(
      classifyUserAgent("Mozilla/5.0 (compatible; ClaudeBot/1.0)").name,
    ).toBe("claudebot");
    expect(classifyUserAgent("claude-code/2.1.0").name).toBe("claude-code");
  });

  it("recognizes install tooling", () => {
    expect(classifyUserAgent("shadcn/2.3.0 node/22.0.0")).toEqual({
      kind: "cli",
      name: "shadcn",
    });
    expect(classifyUserAgent("curl/8.7.1")).toEqual({
      kind: "cli",
      name: "curl",
    });
    expect(classifyUserAgent("node-fetch/1.0")).toEqual({
      kind: "cli",
      name: "node",
    });
  });

  it("falls back to browser for ordinary user-agents", () => {
    const chrome =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
    expect(classifyUserAgent(chrome)).toEqual({
      kind: "browser",
      name: "browser",
    });
  });

  it("treats a missing user-agent as its own bucket", () => {
    expect(classifyUserAgent(null)).toEqual({ kind: "unknown", name: "none" });
    expect(classifyUserAgent("   ")).toEqual({ kind: "unknown", name: "none" });
  });

  it("does not match 'bun' inside unrelated words", () => {
    const ubuntu =
      "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0";
    expect(classifyUserAgent(ubuntu)).toEqual({
      kind: "browser",
      name: "browser",
    });
  });

  it("flags agent traffic but not humans or CLIs", () => {
    expect(isAgentTraffic(classifyUserAgent("claude-code/2.1.0"))).toBe(true);
    expect(
      isAgentTraffic(classifyUserAgent("Mozilla/5.0 (compatible; GPTBot/1.2)")),
    ).toBe(true);
    expect(isAgentTraffic(classifyUserAgent("curl/8.7.1"))).toBe(false);
    expect(isAgentTraffic(classifyUserAgent("Mozilla/5.0 Chrome/131"))).toBe(
      false,
    );
  });
});
